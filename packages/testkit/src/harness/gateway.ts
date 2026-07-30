import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";

export function gatewayRequest(port: number, path: string, credential?: string, body?: unknown) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function waitFor(predicate: () => boolean, message = "condition not reached") {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(message);
}

export async function openEventStream(port: number, credential: string) {
  const controller = new AbortController();
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
        if (done) return;
        buffer += value;
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const message of messages)
          if (message.startsWith("data: "))
            events.push(JSON.parse(message.slice(6)) as SSEEventEnvelope);
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  return { events, abort: () => controller.abort() };
}
