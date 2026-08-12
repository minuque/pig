import { afterEach, describe, expect, it, vi } from "vitest";
import { createApplications, FakePiRuntimeAdapter } from "@pig/testkit";
import type { CommandId, LocalIdentityId, SSEEventEnvelope, WorkspaceId } from "@pig/contracts";

describe("application direct access", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function setup(runtime: FakePiRuntimeAdapter, emit?: (e: SSEEventEnvelope) => void) {
    const platformPort = {
      selectWorkspaceDirectory: async () => undefined,
      canonicalizeWorkspacePath: async (p: string) => p,
    };
    const options = {
      platformPort,
      runtimeAdapter: runtime,
      maxConcurrentRuns: 1,
      ...(emit ? { emit: (_w: WorkspaceId, event: SSEEventEnvelope) => emit(event) } : {}),
    };
    const { workspaces, sessions, runs, stop } = createApplications(options);
    const identityId = "test-identity" as LocalIdentityId;
    const workspace = await workspaces.confirm(
      identityId,
      "C:/direct",
      undefined,
      "setup-cmd" as CommandId,
    );
    const session = await sessions.create(identityId, workspace.id, undefined, "cmd" as CommandId);
    return {
      workspaces,
      sessions,
      runs,
      stop,
      identityId,
      workspaceId: workspace.id,
      sessionId: session.id,
    };
  }

  it("RunsApplication enforces FIFO serial execution for runs on same session", async () => {
    const runtime = new FakePiRuntimeAdapter();
    const createRunCalls: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    vi.spyOn(runtime, "createRun").mockImplementation(async (_w, _s, prompt) => {
      createRunCalls.push(prompt);
      if (createRunCalls.length === 1) await firstGate;
      return { status: "completed" };
    });

    const events: string[] = [];
    const { runs, stop, identityId, workspaceId, sessionId } = await setup(runtime, (e) =>
      events.push(e.type),
    );

    const run1 = await runs.create(
      identityId,
      workspaceId,
      sessionId,
      "first",
      "cmd-1" as CommandId,
    );
    const run2 = await runs.create(
      identityId,
      workspaceId,
      sessionId,
      "second",
      "cmd-2" as CommandId,
    );

    // run1 占住唯一并发槽：run2 必须排队，createRun 只被调一次
    await vi.waitFor(() => expect(createRunCalls).toEqual(["first"]));

    releaseFirst();
    await vi.waitFor(() => expect(createRunCalls).toEqual(["first", "second"]));
    await vi.waitFor(() =>
      expect(events.filter((t) => t.startsWith("run."))).toEqual([
        "run.running",
        "run.completed",
        "run.running",
        "run.completed",
      ]),
    );

    expect(run1.status).toBe("queued");
    expect(run2.status).toBe("queued");
    await stop();
  });

  it("cancel queued run does not touch runtime", async () => {
    const runtime = new FakePiRuntimeAdapter();
    const createRunCalls: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
    vi.spyOn(runtime, "createRun").mockImplementation(async (_w, _s, prompt) => {
      createRunCalls.push(prompt);
      if (createRunCalls.length === 1) await firstGate;
      return { status: "completed" };
    });

    const { runs, stop, identityId, workspaceId, sessionId } = await setup(runtime);

    const run1 = await runs.create(
      identityId,
      workspaceId,
      sessionId,
      "first",
      "cmd-1" as CommandId,
    );
    const run2 = await runs.create(
      identityId,
      workspaceId,
      sessionId,
      "second",
      "cmd-2" as CommandId,
    );
    await vi.waitFor(() => expect(createRunCalls).toEqual(["first"]));

    // 取消排队的 run2：不应触达 runtime，且状态为 cancelled
    const cancelled = await runs.cancel(
      identityId,
      workspaceId,
      sessionId,
      run2.id,
      "cancel-2" as CommandId,
    );
    expect(cancelled.status).toBe("cancelled");
    expect(createRunCalls).toEqual(["first"]);

    releaseFirst();
    await vi.waitFor(() => expect(createRunCalls).toEqual(["first"]));
    await stop();
  });
});
