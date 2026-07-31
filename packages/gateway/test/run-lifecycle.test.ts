import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CommandId,
  PlatformPort,
  Run,
  SessionId,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";
import Gateway, { InMemoryRunRepository } from "../src/index.js";
import { FakePiRuntimeAdapter } from "./fake-pi-runtime.js";
import { gatewayRequest as request } from "@no-pi-no-gang/testkit";

const platformPort: PlatformPort = {
  async selectWorkspaceDirectory() {
    return undefined;
  },
  async canonicalizeWorkspacePath(path) {
    return path.toLowerCase();
  },
};

class DeferredRuntime extends FakePiRuntimeAdapter {
  calls = 0;
  cancelCalls = 0;
  private readonly pending: Array<(result: { status: "completed" | "failed" }) => void> = [];

  override async createRun(
    _workspaceId: WorkspaceId,
    _sessionId: SessionId,
    _prompt: string,
    _commandId?: CommandId,
  ) {
    this.calls++;
    return new Promise<{ status: "completed" | "failed" }>((resolve) => this.pending.push(resolve));
  }

  override async cancelRun() {
    this.cancelCalls++;
  }

  settle(status: "completed" | "failed" = "completed") {
    this.pending.shift()?.({ status });
  }
}

class RacingRunRepository extends InMemoryRunRepository {
  private readsAfterArm = 0;
  arm = false;

  override async findById(id: string) {
    const current = await super.findById(id);
    if (this.arm && ++this.readsAfterArm === 2 && current) {
      await super.save({ ...current, status: "completed", updatedAt: new Date() });
      return current;
    }
    return current;
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
  it("queues same-session runs FIFO, settles, and releases the slot", async () => {
    const { port, credential, runtime, workspace, runsPath } = await setup();
    const first = (await (
      await request(port, runsPath, credential, { commandId: "run-1", prompt: "secret prompt" })
    ).json()) as { run: Run };
    const second = (await (
      await request(port, runsPath, credential, { commandId: "run-2", prompt: "second" })
    ).json()) as { run: Run };
    expect(first.run).toMatchObject({ workspaceId: workspace.id });
    expect(second.run.status).toBe("queued");
    expect(runtime.calls).toBe(1);

    const runPath = `${runsPath}/${first.run.id}`;
    expect((await (await request(port, runPath, credential)).json()) as unknown).toMatchObject({
      run: { status: "running" },
    });
    runtime.settle();
    expect((await waitForStatus(port, runPath, credential, "completed")).status).toBe("completed");

    await waitForStatus(port, `${runsPath}/${second.run.id}`, credential, "running");
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

  it("does not cancel after a terminal state wins the read-transition race", async () => {
    directory = await mkdtemp(join(tmpdir(), "gateway-cancel-race-"));
    const runtime = new DeferredRuntime(join(directory, "sessions.jsonl"));
    const repository = new RacingRunRepository();
    gateway = new Gateway({
      platformPort,
      runtimeAdapter: runtime,
      runRepository: repository,
      bootstrapSecret: "secret",
    });
    const port = await gateway.start();
    const boot = await fetch(`http://127.0.0.1:${port}/api/v1/bootstrap`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: "secret" }),
    });
    const { credential } = (await boot.json()) as { credential: string };
    const workspace = (
      (await (
        await request(port, "/api/v1/workspaces/confirm", credential, {
          path: "C:/Race",
          commandId: "workspace",
        })
      ).json()) as { workspace: { id: string } }
    ).workspace;
    const session = (
      (await (
        await request(port, `/api/v1/workspaces/${workspace.id}/sessions`, credential, {
          commandId: "session",
        })
      ).json()) as { session: { id: string } }
    ).session;
    const runsPath = `/api/v1/workspaces/${workspace.id}/sessions/${session.id}/runs`;
    const run = (
      (await (
        await request(port, runsPath, credential, { commandId: "run", prompt: "race" })
      ).json()) as { run: Run }
    ).run;
    await waitForStatus(port, `${runsPath}/${run.id}`, credential, "running");
    repository.arm = true;

    const cancelled = await request(port, `${runsPath}/${run.id}/cancel`, credential, {
      commandId: "cancel",
    });
    expect(((await cancelled.json()) as { run: Run }).run.status).toBe("completed");
    expect(runtime.cancelCalls).toBe(0);
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
