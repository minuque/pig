import { z } from "zod";
import {
  EventCursorSchema,
  GatewayEventSchema,
  StreamControlEventSchema,
  gatewayEventSchemas,
  type EventCursor,
  type GatewayEvent,
  type GatewayStreamItem,
  type StreamControlEvent,
} from "@no-pi-no-gang/contracts";
import { GatewayRequestError, GatewayStreamOpenError } from "@/lib/gateway/errors";
import { ProblemDetailsSchema } from "@no-pi-no-gang/contracts";

/** A future event type this client does not know yet. Cursor-relevant only. */
export interface UnknownGatewayEvent {
  type: string;
  gatewayEpoch: string;
  gatewaySeq: number;
}

export type WebStreamItem = GatewayStreamItem | { kind: "event"; event: UnknownGatewayEvent };

const UnknownEventEnvelopeSchema = z.object({
  type: z.string().min(1),
  gatewayEpoch: z.string().min(1),
  gatewaySeq: z.number().int().positive(),
});

const knownEventTypes = new Set<string>(Object.keys(gatewayEventSchemas));

export function isUnknownGatewayEvent(
  event: GatewayEvent | StreamControlEvent | UnknownGatewayEvent,
): event is UnknownGatewayEvent {
  return (
    !knownEventTypes.has(event.type) &&
    event.type !== "stream.ready" &&
    event.type !== "stream.reset"
  );
}

/**
 * Decode one SSE `data:` payload. Known events are zod-validated; unknown
 * future event types with a valid envelope pass through so the Sync
 * Controller can advance the cursor without mutating known state. A known
 * event that fails validation is a decode failure and throws.
 */
export function decodeStreamEventData(
  data: string,
): GatewayEvent | StreamControlEvent | UnknownGatewayEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new GatewayRequestError("decode", "SSE frame is not valid JSON");
  }
  const type =
    typeof parsed === "object" && parsed !== null && "type" in parsed
      ? String((parsed as { type: unknown }).type)
      : "";
  if (type === "stream.ready" || type === "stream.reset") {
    try {
      return StreamControlEventSchema.parse(parsed);
    } catch {
      throw new GatewayRequestError("decode", `Stream control event failed contract validation`);
    }
  }
  if (knownEventTypes.has(type)) {
    try {
      return GatewayEventSchema.parse(parsed) as GatewayEvent;
    } catch {
      throw new GatewayRequestError("decode", `Gateway event "${type}" failed contract validation`);
    }
  }
  const unknown = UnknownEventEnvelopeSchema.safeParse(parsed);
  if (unknown.success) return unknown.data;
  throw new GatewayRequestError("decode", "SSE frame has no usable envelope");
}

interface SseFrame {
  id: string | null;
  data: string;
}

/** Parse an SSE byte stream into frames. */
export async function* readSseFrames(body: ReadableStream<Uint8Array>): AsyncIterable<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let id: string | null = null;
  let dataLines: string[] = [];
  const dispatch = (): SseFrame | null => {
    if (dataLines.length === 0) {
      id = null;
      return null;
    }
    const frame: SseFrame = { id, data: dataLines.join("\n") };
    id = null;
    dataLines = [];
    return frame;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        if (line === "") {
          const frame = dispatch();
          if (frame) yield frame;
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let fieldValue = colon === -1 ? "" : line.slice(colon + 1);
        if (fieldValue.startsWith(" ")) fieldValue = fieldValue.slice(1);
        if (field === "data") dataLines.push(fieldValue);
        else if (field === "id") id = fieldValue;
      }
    }
    const frame = dispatch();
    if (frame) yield frame;
  } finally {
    reader.releaseLock();
  }
}

const sleep = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });

export interface OpenSseOptions {
  after?: EventCursor | undefined;
  signal: AbortSignal;
  fetchFn?: typeof fetch;
}

/**
 * Transport-level SSE adapter. Retries transient network failures internally
 * with bounded backoff, replaying from the last accepted frame id. Fatal HTTP
 * problem responses (auth, cursor, protocol) throw GatewayStreamOpenError for
 * the Sync Controller to resolve semantically.
 */
export async function* openEventStream(options: OpenSseOptions): AsyncIterable<WebStreamItem> {
  const fetchFn = options.fetchFn ?? fetch;
  let after: EventCursor | undefined = options.after;
  let attempt = 0;
  yield { kind: "connection", state: "connecting" };
  for (;;) {
    if (options.signal.aborted) return;
    let streamOpened = false;
    try {
      const url = after ? `/api/v1/events?after=${encodeURIComponent(after)}` : "/api/v1/events";
      const response = await fetchFn(url, {
        headers: { accept: "text/event-stream" },
        credentials: "same-origin",
        signal: options.signal,
      });
      if (!response.ok || !response.body) {
        let problemBody: unknown = null;
        try {
          problemBody = await response.json();
        } catch {
          /* non-JSON error body */
        }
        const problem = ProblemDetailsSchema.safeParse(problemBody);
        if (problem.success) throw new GatewayStreamOpenError(problem.data);
        throw new GatewayStreamOpenError({
          type: "about:blank",
          title: "stream.unavailable",
          status: response.status,
          detail: `事件流打开失败（HTTP ${response.status}）`,
          instance: "/api/v1/events",
          code: "server.unavailable",
          requestId: "web-client",
          retryable: true,
        });
      }
      streamOpened = true;
      attempt = 0;
      yield { kind: "connection", state: "live" };
      for await (const frame of readSseFrames(response.body)) {
        if (options.signal.aborted) return;
        if (frame.id) {
          const cursor = EventCursorSchema.safeParse(frame.id);
          if (cursor.success) after = cursor.data;
        }
        const decoded = decodeStreamEventData(frame.data);
        if (isUnknownGatewayEvent(decoded)) {
          yield { kind: "event", event: decoded };
        } else {
          yield { kind: "event", event: decoded };
        }
      }
      if (options.signal.aborted) return;
      throw new Error("SSE stream ended unexpectedly");
    } catch (error) {
      if (options.signal.aborted) return;
      if (error instanceof GatewayStreamOpenError && streamOpened === false) {
        throw error;
      }
      if (error instanceof GatewayRequestError) throw error;
      attempt += 1;
      yield { kind: "connection", state: "reconnecting" };
      await sleep(Math.min(500 * attempt, 4000), options.signal).catch(() => {});
      if (options.signal.aborted) return;
    }
  }
}
