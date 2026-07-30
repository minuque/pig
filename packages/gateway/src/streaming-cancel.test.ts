import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CommandId,
  PiRunEvent,
  PlatformPort,
  Run,
  SessionId,
  SSEEventEnvelope,
} from "@no-pi-no-gang/contracts";
import Gateway, { PiRuntimeAdapterImpl } from "./index.js";

const platformPort: PlatformPort = {
  async canonicalizeWorkspacePath(path) {
    return path.toLowerCase();
  },
};

class StreamingRuntime extends PiRuntimeAdapterImpl {
  cancelCalls = 0;
  readonly pending: Array<{
    emit: (event: PiRunEvent) => void;
    settle: (result: { status: "completed" | "failed" }) => void;
  }> = [];

  override async createRun(
    _sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
    onEvent: (event: PiRunEvent) => void = () => undefined,
  ) {
    return new Promise<{ status: "completed" | "failed" }>((settle) =>
      this.pending.push({ emit: onEvent, settle }),
    );
  }

  override async cancelRun() {
    this.cancelCalls++;
  }
}

let gateway: Gateway | undefined;
let directory: string | undefined;
let abortEvents: (() => void) | undefined;
afterEach(async () => {
  abortEvents?.();
  await gateway?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  gateway = undefined;
  directory = undefined;
  abortEvents = undefined;
});

async function request(port: number, path: string, credential: string, body?: unknown) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${credential}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function setup() {
  directory = await mkdtemp(join(tmpdir(), "gateway-streaming-"));
  const runtime = new StreamingRuntime(join(directory, "sessions.jsonl"));
  gateway = new Gateway({ platformPort, runtimeAdapter: runtime, bootstrapSecret: "secret" });
  const port = await gateway.start();
  const boot = await fetch(`http://127.0.0.1:${port}/api/v1/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: "secret" }),
  });
  const { credential } = (await boot.json()) as { credential: string };
  const confirmed = await request(port, "/api/v1/workspaces/confirm", credential, {
    path: "C:/Project",
    commandId: "workspace",
  });
  const { workspace } = (await confirmed.json()) as { workspace: { id: string } };
  const sessionsPath = `/api/v1/workspaces/${workspace.id}/sessions`;
  const sessionIds: string[] = [];
  for (const commandId of ["session-1", "session-2"]) {
    const response = await request(port, sessionsPath, credential, { commandId });
    sessionIds.push(((await response.json()) as { session: { id: string } }).session.id);
  }
  return {
    port,
    credential,
    runtime,
    runs: [
      `${sessionsPath}/${sessionIds[0]!}/runs`,
      `${sessionsPath}/${sessionIds[1]!}/runs`,
    ] as const,
  };
}

async function openEvents(port: number, credential: string) {
  const controller = new AbortController();
  abortEvents = () => controller.abort();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/events`, {
    headers: { authorization: `Bearer ${credential}` },
    signal: controller.signal,
  });
  const events: SSEEventEnvelope[] = [];
  void (async () => {
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const messages = buffer.split("\n\n");
        buffer = messages.pop()!;
        for (const message of messages)
          if (message.startsWith("data: ")) events.push(JSON.parse(message.slice(6)));
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  return events;
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("condition not reached");
}

async function createRun(port: number, path: string, credential: string, commandId: string) {
  const response = await request(port, path, credential, { commandId, prompt: commandId });
  expect(response.status).toBe(201);
  return ((await response.json()) as { run: Run }).run;
}

describe("gateway SSE streaming and cancel", () => {
  it("requires authentication and routes increments by stable session/run identity", async () => {
    const { port, credential, runtime, runs } = await setup();
    expect((await fetch(`http://127.0.0.1:${port}/api/v1/events`)).status).toBe(401);
    const events = await openEvents(port, credential);

    const first = await createRun(port, runs[0], credential, "run-1");
    runtime.pending[0]!.emit({ type: "run.output.delta", data: { text: "one" } });
    runtime.pending[0]!.settle({ status: "completed" });
    await waitFor(() => events.some(({ type }) => type === "run.completed"));

    const second = await createRun(port, runs[1], credential, "run-2");
    runtime.pending[1]!.emit({ type: "run.output.delta", data: { text: "two" } });
    runtime.pending[1]!.settle({ status: "failed" });
    await waitFor(() => events.some(({ type }) => type === "run.failed"));

    const deltas = events.filter(({ type }) => type === "run.output.delta");
    expect(deltas).toMatchObject([
      { sessionId: first.sessionId, runId: first.id, data: { text: "one" } },
      { sessionId: second.sessionId, runId: second.id, data: { text: "two" } },
    ]);
    expect(
      events
        .filter(({ type }) => type.startsWith("run."))
        .every(({ version, sessionId, runId }) => version === "0.1.0" && sessionId && runId),
    ).toBe(true);
  });

  it("cancels idempotently, rejects payload reuse, releases the slot, and ignores late Pi activity", async () => {
    const { port, credential, runtime, runs } = await setup();
    const events = await openEvents(port, credential);
    const first = await createRun(port, runs[0], credential, "run-1");
    const cancelPath = `${runs[0]}/${first.id}/cancel`;
    const cancel = () => request(port, cancelPath, credential, { commandId: "cancel-1" });

    const cancelled = (await (await cancel()).json()) as { run: Run };
    expect(cancelled.run.status).toBe("cancelled");
    expect((await (await cancel()).json()) as unknown).toEqual(cancelled);
    expect(runtime.cancelCalls).toBe(1);

    const next = await createRun(port, runs[1], credential, "run-2");
    const conflict = await request(port, `${runs[1]}/${next.id}/cancel`, credential, {
      commandId: "cancel-1",
    });
    expect(conflict.status).toBe(409);
    runtime.pending[0]!.emit({ type: "run.output.delta", data: { text: "late" } });
    runtime.pending[0]!.settle({ status: "completed" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const stored = (await (await request(port, `${runs[0]}/${first.id}`, credential)).json()) as {
      run: Run;
    };
    expect(stored.run.status).toBe("cancelled");
    expect(events).not.toContainEqual(expect.objectContaining({ data: { text: "late" } }));
    runtime.pending[1]!.settle({ status: "completed" });
    expect(next.id).not.toBe(first.id);
  });

  it("lets exactly one terminal outcome win a cancel/natural-completion race", async () => {
    const { port, credential, runtime, runs } = await setup();
    const events = await openEvents(port, credential);
    const run = await createRun(port, runs[0], credential, "run-race");
    runtime.pending[0]!.settle({ status: "completed" });
    await request(port, `${runs[0]}/${run.id}/cancel`, credential, { commandId: "cancel-race" });
    await waitFor(() =>
      events.some(({ type }) => type === "run.completed" || type === "run.cancelled"),
    );
    expect(
      events.filter(({ type }) => type === "run.completed" || type === "run.cancelled"),
    ).toHaveLength(1);
    const stored = (await (await request(port, `${runs[0]}/${run.id}`, credential)).json()) as {
      run: Run;
    };
    expect(["completed", "cancelled"]).toContain(stored.run.status);
  });
});
