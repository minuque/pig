import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, describe, expect, it } from "vitest";

import type { CommandId, PlatformPort, Run, SessionId } from "@no-pi-no-gang/contracts";
import Gateway, { InMemoryRunRepository, PiRuntimeAdapterImpl } from "./index.js";

const platformPort: PlatformPort = {
  async canonicalizeWorkspacePath(path) {
    return path.toLowerCase();
  },
};

class DeferredRuntime extends PiRuntimeAdapterImpl {
  calls = 0;
  private readonly pending: Array<(result: { status: "completed" | "failed" }) => void> = [];

  override async createRun(_sessionId: SessionId, _prompt: string, _commandId?: CommandId) {
    this.calls++;
    return new Promise<{ status: "completed" | "failed" }>((resolve) => this.pending.push(resolve));
  }

  settle(status: "completed" | "failed" = "completed") {
    this.pending.shift()?.({ status });
  }
}

let gateway: Gateway | undefined;
let directory: string | undefined;
afterEach(async () => {
  await gateway?.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
  gateway = undefined;
  directory = undefined;
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
  directory = await mkdtemp(join(tmpdir(), "gateway-runs-"));
  const runtime = new DeferredRuntime(join(directory, "sessions.jsonl"));
  gateway = new Gateway({ platformPort, runtimeAdapter: runtime, bootstrapSecret: "secret" });
  const port = await gateway.start();
  const boot = await fetch(`http://127.0.0.1:${port}/api/v1/bootstrap`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: "secret" }),
  });
  const { credential } = (await boot.json()) as { credential: string };
  const workspaceResponse = await request(port, "/api/v1/workspaces/confirm", credential, {
    path: "C:/Project",
    commandId: "workspace",
  });
  const { workspace } = (await workspaceResponse.json()) as { workspace: { id: string } };
  const sessionsPath = `/api/v1/workspaces/${workspace.id}/sessions`;
  const sessionResponse = await request(port, sessionsPath, credential, { commandId: "session" });
  const { session } = (await sessionResponse.json()) as { session: { id: string } };
  return { port, credential, runtime, workspace, runsPath: `${sessionsPath}/${session.id}/runs` };
}

async function waitForStatus(
  port: number,
  path: string,
  credential: string,
  status: Run["status"],
) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await request(port, path, credential);
    const body = (await response.json()) as { run: Run };
    if (body.run.status === status) return body.run;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`run did not reach ${status}`);
}

describe("run lifecycle", () => {
  it("admits one run, rejects concurrency without Pi, settles, and releases the slot", async () => {
    const { port, credential, runtime, workspace, runsPath } = await setup();
    const responses = await Promise.all([
      request(port, runsPath, credential, { commandId: "run-1", prompt: "secret prompt" }),
      request(port, runsPath, credential, { commandId: "run-2", prompt: "second" }),
    ]);
    const firstResponse = responses.find(({ status }) => status === 201)!;
    const blocked = responses.find(({ status }) => status === 409)!;
    const first = (await firstResponse.json()) as { run: Run };
    expect(first.run).toMatchObject({ workspaceId: workspace.id, status: "admission" });
    expect(await blocked.json()).toEqual({ code: "ACTIVE_RUN_LIMIT" });
    expect(runtime.calls).toBe(1);

    const runPath = `${runsPath}/${first.run.id}`;
    expect((await (await request(port, runPath, credential)).json()) as unknown).toMatchObject({
      run: { status: "running" },
    });
    runtime.settle();
    expect((await waitForStatus(port, runPath, credential, "completed")).status).toBe("completed");

    const next = await request(port, runsPath, credential, { commandId: "run-3", prompt: "after" });
    expect(next.status).toBe(201);
    const nextRun = ((await next.json()) as { run: Run }).run;
    expect(nextRun.id).not.toBe(first.run.id);
    expect(runtime.calls).toBe(2);
    runtime.settle();
  });

  it("returns an idempotent run and rejects command payload reuse", async () => {
    const { port, credential, runtime, runsPath } = await setup();
    const create = () =>
      request(port, runsPath, credential, { commandId: "same", prompt: "same prompt" });
    const first = ((await (await create()).json()) as { run: Run }).run;
    const retry = ((await (await create()).json()) as { run: Run }).run;
    expect(retry.id).toBe(first.id);
    expect(runtime.calls).toBe(1);
    const conflict = await request(port, runsPath, credential, {
      commandId: "same",
      prompt: "changed",
    });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ code: "COMMAND_ID_CONFLICT" });
    runtime.settle("failed");
    await waitForStatus(port, `${runsPath}/${first.id}`, credential, "failed");
  });

  it("does not resurrect a terminal run", async () => {
    const repository = new InMemoryRunRepository();
    const now = new Date();
    const completed = {
      id: "run" as Run["id"],
      workspaceId: "workspace" as Run["workspaceId"],
      sessionId: "session" as Run["sessionId"],
      commandId: "command" as Run["commandId"],
      prompt: "prompt",
      status: "completed" as const,
      createdAt: now,
      updatedAt: now,
    };
    await repository.save(completed);
    await repository.save({ ...completed, status: "running" });
    expect((await repository.findById("run"))?.status).toBe("completed");
  });
});
