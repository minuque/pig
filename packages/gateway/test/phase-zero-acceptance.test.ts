import { appendFile, mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  CommandId,
  PiRunEvent,
  PlatformPort,
  Run,
  SessionId,
  SSEEventEnvelope,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";
import Gateway from "../src/index.js";
import { FakePiRuntimeAdapter } from "./fake-pi-runtime.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const platformPort: PlatformPort = {
  async selectWorkspaceDirectory() {
    return undefined;
  },
  async canonicalizeWorkspacePath(path) {
    return path.toLowerCase();
  },
};

class AcceptanceRuntime extends FakePiRuntimeAdapter {
  constructor(private readonly path: string) {
    super(path);
  }

  override async createRun(
    _workspaceId: WorkspaceId,
    sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
    onEvent: (event: PiRunEvent) => void = () => undefined,
  ) {
    onEvent({ type: "run.output.delta", data: { text: "streamed answer" } });
    await appendFile(
      this.path,
      `${JSON.stringify({
        type: "message",
        canonicalPath: "c:/acceptance",
        sessionId,
        role: "assistant",
        content: "durable answer",
        toolResult: "TOOL_PAYLOAD_CANARY",
      })}\n`,
    );
    return { status: "completed" as const, output: "streamed answer" };
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
  vi.restoreAllMocks();
});

async function request(port: number, path: string, credential?: string, body?: unknown) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(credential ? { authorization: `Bearer ${credential}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 5));
  }
  throw new Error("acceptance condition not reached");
}

async function events(port: number, credential: string) {
  const controller = new AbortController();
  abortEvents = () => controller.abort();
  const response = await fetch(`http://127.0.0.1:${port}/api/v1/events`, {
    headers: { authorization: `Bearer ${credential}` },
    signal: controller.signal,
  });
  const received: SSEEventEnvelope[] = [];
  void (async () => {
    const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "";
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) return;
        buffer += part.value;
        const messages = buffer.split("\n\n");
        buffer = messages.pop() ?? "";
        for (const message of messages)
          if (message.startsWith("data: ")) received.push(JSON.parse(message.slice(6)));
      }
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    }
  })();
  return received;
}

describe("Phase 0 acceptance gate", () => {
  it("runs Workspace -> Session -> Prompt -> SSE -> terminal -> durable transcript reload without logging canaries", async () => {
    const logs: unknown[] = [];
    for (const method of ["log", "info", "warn", "error"] as const)
      vi.spyOn(console, method).mockImplementation((...values) => logs.push(values));
    directory = await mkdtemp(join(tmpdir(), "phase-zero-"));
    gateway = new Gateway({
      platformPort,
      runtimeAdapter: new AcceptanceRuntime(join(directory, "sessions.jsonl")),
      bootstrapSecret: "BOOTSTRAP_CANARY",
    });
    const port = await gateway.start();
    expect(port).toBeGreaterThan(0);

    const bootstrap = await request(port, "/api/v1/bootstrap", undefined, {
      secret: "BOOTSTRAP_CANARY",
    });
    const { credential } = (await bootstrap.json()) as { credential: string };
    const workspaceResponse = await request(port, "/api/v1/workspaces/confirm", credential, {
      path: "C:/Acceptance",
      commandId: "workspace-command",
    });
    const { workspace } = (await workspaceResponse.json()) as { workspace: { id: string } };
    const sessionsPath = `/api/v1/workspaces/${workspace.id}/sessions`;
    const sessionResponse = await request(port, sessionsPath, credential, {
      commandId: "session-command",
    });
    const { session } = (await sessionResponse.json()) as { session: { id: string } };
    const received = await events(port, credential);
    const runResponse = await request(port, `${sessionsPath}/${session.id}/runs`, credential, {
      commandId: "run-command",
      prompt: "FULL_PROMPT_CANARY",
    });
    const { run } = (await runResponse.json()) as { run: Run };

    await waitFor(() => received.some(({ type }) => type === "run.completed"));
    expect(received).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "run.output.delta",
          sessionId: session.id,
          runId: run.id,
          data: { text: "streamed answer" },
        }),
        expect.objectContaining({ type: "run.completed", sessionId: session.id, runId: run.id }),
      ]),
    );
    expect(
      await (await request(port, `${sessionsPath}/${session.id}/transcript`, credential)).json(),
    ).toMatchObject({ transcript: [{ content: "durable answer" }] });
    const serializedLogs = JSON.stringify(logs);
    for (const canary of [
      "BOOTSTRAP_CANARY",
      credential,
      "FULL_PROMPT_CANARY",
      "durable answer",
      "TOOL_PAYLOAD_CANARY",
    ])
      expect(serializedLogs).not.toContain(canary);
  });

  it("has only a random loopback listen path and a single-use bootstrap", async () => {
    directory = await mkdtemp(join(tmpdir(), "phase-zero-canary-"));
    gateway = new Gateway({
      platformPort,
      runtimeAdapter: new AcceptanceRuntime(join(directory, "sessions.jsonl")),
      bootstrapSecret: "BOOTSTRAP_CANARY",
    });
    const firstPort = await gateway.start();
    const source = await readFile(join(root, "packages/gateway/src/server/Gateway.ts"), "utf8");
    expect(source.match(/\.listen\(/g)).toHaveLength(1);
    expect(source).toContain('this.server.listen(0, "127.0.0.1"');
    expect(firstPort).toBeGreaterThan(0);

    const bootstrap = await request(firstPort, "/api/v1/bootstrap", undefined, {
      secret: "BOOTSTRAP_CANARY",
    });
    expect(bootstrap.status).toBe(201);
    expect(
      (
        await request(firstPort, "/api/v1/bootstrap", undefined, {
          secret: "BOOTSTRAP_CANARY",
        })
      ).status,
    ).toBe(401);
  });

  it("locks package, adapter, repository, index, platform, authorization, policy, and Phase 1 boundaries", async () => {
    const read = (path: string) => readFile(join(root, path), "utf8");
    const [contracts, gatewaySource, webSource, app, rootPackage, gatewayPackage, webPackage] =
      await Promise.all([
        read("packages/contracts/src/index.ts"),
        Promise.all([
          read("packages/gateway/src/server/Gateway.ts"),
          read("packages/gateway/src/application/workspaces.ts"),
          read("packages/gateway/src/application/sessions.ts"),
          read("packages/gateway/src/application/runs.ts"),
          read("packages/gateway/src/adapters/pi/runtime.ts"),
          read("packages/gateway/src/adapters/repositories/run-repository.ts"),
        ]).then((parts) => parts.join("\n")),
        read("packages/web/src/api/index.ts"),
        read("packages/web/src/app/App.vue"),
        read("package.json"),
        read("packages/gateway/package.json"),
        read("packages/web/package.json"),
      ]);
    const gatewayDependencies = JSON.parse(gatewayPackage).dependencies;
    const webDependencies = JSON.parse(webPackage).dependencies;

    expect(gatewayDependencies).toEqual({
      "@earendil-works/pi-coding-agent": "0.83.0",
      "@no-pi-no-gang/contracts": "0.0.0",
    });
    expect(webDependencies).not.toHaveProperty("@no-pi-no-gang/testkit");
    expect(contracts).not.toMatch(/from ["'](?:vue|node:|fs|path|http|@pi)/);
    expect(gatewaySource).toContain("implements PiRuntimeAdapter");
    expect(gatewaySource).toContain("runtime.discoverSessions");
    expect(gatewaySource).toContain("implements RunRepository");
    expect(gatewaySource).toContain("platform.canonicalizeWorkspacePath");
    expect(gatewaySource).toContain("workspaces.get(identityId");
    expect(gatewaySource).toContain('status: "queued"');
    expect(gatewaySource).toContain("maxConcurrentRuns");
    expect(webSource).not.toMatch(/@pi|PiRuntime|piSession/);
    expect(app).toContain('html-policy="safe"');
    expect(app).not.toContain("v-html");
    expect(app).not.toMatch(/innerHTML|javascript:|\sonerror\s*=/i);
    expect(`${contracts}\n${rootPackage}`).not.toMatch(/replay|epoch|revision/i);
  });
});
