import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type RuntimeAdapter,
  RuntimeCoordinator,
  type RuntimeExecution,
} from "../src/runtime/coordinator.js";
import { EventHub } from "../src/stream/hub.js";
import { addPrincipalWorkspaceSession, openStore, removeTempDir, tempDir } from "./helpers.js";

class ControlledAdapter implements RuntimeAdapter {
  readonly starts: Array<{
    run: string;
    resolve: () => void;
    settleCancel: () => void;
    cancelled: boolean;
    modelId: string;
    thinkingLevel: string;
    emit: (target: "text" | "thinking", text: string) => void;
  }> = [];
  private readonly startWaiters: Array<{ count: number; resolve: () => void }> = [];

  waitForStarts(count: number): Promise<void> {
    if (this.starts.length >= count) return Promise.resolve();
    return new Promise((resolve) => this.startWaiters.push({ count, resolve }));
  }

  async start(
    input: {
      sourcePath: string;
      prompt: string;
      modelId: string;
      thinkingLevel: string;
      agentDir: string;
    },
    onDelta: (target: "text" | "thinking", text: string) => void,
  ): Promise<RuntimeExecution> {
    const item = {
      run: input.prompt,
      resolve: () => {},
      settleCancel: () => {},
      cancelled: false,
      modelId: input.modelId,
      thinkingLevel: input.thinkingLevel,
      emit: onDelta,
    };
    const completion = new Promise<void>((resolve) => {
      item.resolve = resolve;
    });
    const cancelSettlement = new Promise<void>((resolve) => {
      item.settleCancel = resolve;
    });
    this.starts.push(item);
    for (const waiter of this.startWaiters.splice(0)) {
      if (this.starts.length >= waiter.count) waiter.resolve();
      else this.startWaiters.push(waiter);
    }
    return {
      completion,
      steer: async () => {},
      cancel: async () => {
        item.cancelled = true;
        await cancelSettlement;
        item.resolve();
      },
      dispose: () => {},
    };
  }
}

const cleanups: string[] = [];
afterEach(async () => {
  await Promise.all(cleanups.splice(0).map(removeTempDir));
});

function body(commandId: string, prompt: string) {
  return {
    commandId,
    prompt,
    executionProfile: { modelId: "model_1", thinkingLevel: "off" },
  };
}

describe("RuntimeCoordinator", () => {
  it("keeps runs FIFO per session and limits active sessions", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, JSON.stringify({ type: "session", id: "s", cwd: dir }) + "\n");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub("epoch_1"), dir, 1, adapter);
      const first = coordinator.createRun("principal_1", "session_1", body("cmd_1", "first"));
      const second = coordinator.createRun("principal_1", "session_1", body("cmd_2", "second"));
      expect(first.runId).not.toBe(second.runId);
      expect(adapter.starts.map((x) => x.run)).toEqual(["first"]);
      adapter.starts[0]!.resolve();
      await adapter.waitForStarts(2);
      expect(adapter.starts.map((x) => x.run)).toEqual(["first", "second"]);
      adapter.starts[1]!.resolve();
      await coordinator.waitForIdle();
      expect(
        store.all<{ state: string }>("SELECT state FROM runs ORDER BY ordinal").map((x) => x.state),
      ).toEqual(["completed", "completed"]);
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("replays equivalent commands and rejects payload conflicts", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter);
      const first = coordinator.createRun("principal_1", "session_1", body("same", "prompt"));
      const replay = coordinator.createRun("principal_1", "session_1", body("same", "prompt"));
      expect(replay).toEqual(first);
      expect(store.row<{ count: number }>("SELECT count(*) AS count FROM runs")?.count).toBe(1);
      expect(() =>
        coordinator.createRun("principal_1", "session_1", body("same", "changed")),
      ).toThrow("command.idempotency_conflict");
      adapter.starts[0]!.resolve();
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("marks interrupted work on restart and keeps terminal state immutable", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    store.run(
      "INSERT INTO runs(run_id,session_id,command_id,prompt,profile_json,state,ordinal,retry_of_run_id,failure_code,revision,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      "run_old",
      "session_1",
      "cmd_old",
      "old",
      JSON.stringify({ modelId: "model_1", thinkingLevel: "off" }),
      "running",
      1,
      null,
      null,
      2,
      "now",
      "now",
    );
    try {
      const coordinator = new RuntimeCoordinator(
        store,
        new EventHub(),
        dir,
        1,
        new ControlledAdapter(),
      );
      expect(
        store.row<{ state: string }>("SELECT state FROM runs WHERE run_id='run_old'")?.state,
      ).toBe("interrupted");
      expect(coordinator.update("run_old", "completed")).toBe(false);
      expect(
        store.row<{ state: string }>("SELECT state FROM runs WHERE run_id='run_old'")?.state,
      ).toBe("interrupted");
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("cancels queued work and sends cancellation to active Pi execution", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter);
      const first = coordinator.createRun("principal_1", "session_1", body("cmd_1", "active"));
      const second = coordinator.createRun("principal_1", "session_1", body("cmd_2", "queued"));
      await adapter.waitForStarts(1);
      await coordinator.cancel(second.runId, "principal_1", "cancel_2");
      expect(
        store.row<{ state: string }>("SELECT state FROM runs WHERE run_id=?", second.runId)?.state,
      ).toBe("cancelled");
      const cancelling = coordinator.cancel(first.runId, "principal_1", "cancel_1");
      expect(adapter.starts[0]!.cancelled).toBe(true);
      expect(
        store.row<{ state: string }>("SELECT state FROM runs WHERE run_id=?", first.runId)?.state,
      ).toBe("cancelling");
      expect(coordinator.update(first.runId, "completed")).toBe(false);
      adapter.starts[0]!.settleCancel();
      await cancelling;
      expect(
        store.row<{ state: string }>("SELECT state FROM runs WHERE run_id=?", first.runId)?.state,
      ).toBe("cancelled");
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("waits for Pi settlement before confirming cancel or starting the next Run", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter);
      const first = coordinator.createRun(
        "principal_1",
        "session_1",
        body("cmd_boundary_1", "first"),
      );
      coordinator.createRun("principal_1", "session_1", body("cmd_boundary_2", "second"));
      await adapter.waitForStarts(1);
      const cancelling = coordinator.cancel(first.runId);
      await Promise.resolve();
      expect(adapter.starts.map((item) => item.run)).toEqual(["first"]);
      expect(store.row<any>("SELECT state FROM runs WHERE run_id=?", first.runId)?.state).toBe(
        "cancelling",
      );
      adapter.starts[0]!.settleCancel();
      await cancelling;
      await adapter.waitForStarts(2);
      expect(adapter.starts.map((item) => item.run)).toEqual(["first", "second"]);
      adapter.starts[1]!.resolve();
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("marks a cancel interrupted after the settlement timeout but keeps the Session blocked", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter, 10);
      const first = coordinator.createRun("principal_1", "session_1", body("timeout_1", "first"));
      coordinator.createRun("principal_1", "session_1", body("timeout_2", "second"));
      await adapter.waitForStarts(1);
      await coordinator.cancel(first.runId);
      expect(
        store.row<any>("SELECT state,failure_code FROM runs WHERE run_id=?", first.runId),
      ).toMatchObject({
        state: "interrupted",
        failure_code: "run.cancel_timeout",
      });
      expect(adapter.starts).toHaveLength(1);
      adapter.starts[0]!.settleCancel();
      await adapter.waitForStarts(2);
      adapter.starts[1]!.resolve();
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("uses global admission order fairly and does not let a busy Session starve another", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    store.run(
      "INSERT INTO sessions(session_id,workspace_id,source_path,name,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      "session_2",
      "workspace_1",
      source,
      "Second",
      "2025-01-01T00:00:00.000Z",
      "2025-01-01T00:00:00.000Z",
    );
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter);
      coordinator.createRun("principal_1", "session_1", body("fair_1", "a1"));
      coordinator.createRun("principal_1", "session_1", body("fair_2", "a2"));
      coordinator.createRun("principal_1", "session_2", body("fair_3", "b1"));
      adapter.starts[0]!.resolve();
      await adapter.waitForStarts(2);
      coordinator.createRun("principal_1", "session_1", body("fair_4", "a3"));
      adapter.starts[1]!.resolve();
      await adapter.waitForStarts(3);
      expect(adapter.starts.map((item) => item.run)).toEqual(["a1", "a2", "b1"]);
      adapter.starts[2]!.resolve();
      await adapter.waitForStarts(4);
      expect(adapter.starts[3]!.run).toBe("a3");
      adapter.starts[3]!.resolve();
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("freezes the complete profile and emits independent monotonic runSeq with full scope", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const hub = new EventHub("scope_epoch");
      const coordinator = new RuntimeCoordinator(store, hub, dir, 1, adapter);
      const original = coordinator.createRun(
        "principal_1",
        "session_1",
        body("scope_1", "original"),
      );
      await adapter.waitForStarts(1);
      expect(adapter.starts[0]).toMatchObject({
        modelId: "model_1",
        thinkingLevel: "off",
      });
      adapter.starts[0]!.emit("text", "a");
      adapter.starts[0]!.emit("text", "b");
      adapter.starts[0]!.resolve();
      await coordinator.waitForIdle();
      const events = hub.replay()!.filter((event) => event.runId === original.runId);
      expect(events.map((event) => event.runSeq)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(
        events.every(
          (event) => event.workspaceId === "workspace_1" && event.sessionId === "session_1",
        ),
      ).toBe(true);
      expect(
        store.row<any>(
          "SELECT revision,run_seq,profile_json FROM runs WHERE run_id=?",
          original.runId,
        ),
      ).toMatchObject({
        revision: 4,
        run_seq: 6,
        profile_json: JSON.stringify({
          modelId: "model_1",
          thinkingLevel: "off",
        }),
      });

      const retry = coordinator.createRun("principal_1", "session_1", {
        ...body("scope_2", "retry"),
        retryOfRunId: original.runId,
      });
      expect(retry.runId).not.toBe(original.runId);
      expect(
        store.row<any>("SELECT retry_of_run_id FROM runs WHERE run_id=?", retry.runId)
          ?.retry_of_run_id,
      ).toBe(original.runId);
      adapter.starts[1]!.resolve();
      await coordinator.waitForIdle();
      await coordinator.close();
    } finally {
      db.close();
    }
  });

  it("rejects a full per-session queue and closes admission deterministically", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    try {
      const adapter = new ControlledAdapter();
      const coordinator = new RuntimeCoordinator(store, new EventHub(), dir, 1, adapter);
      coordinator.createRun("principal_1", "session_1", body("capacity_0", "active"));
      await adapter.waitForStarts(1);
      for (let index = 1; index <= 32; index += 1) {
        coordinator.createRun(
          "principal_1",
          "session_1",
          body(`capacity_${index}`, `queued ${index}`),
        );
      }
      expect(() =>
        coordinator.createRun("principal_1", "session_1", body("capacity_33", "overflow")),
      ).toThrow("run.queue_full");

      adapter.starts[0]!.settleCancel();
      await coordinator.close();
      expect(() =>
        coordinator.createRun("principal_1", "session_1", body("after_close", "closed")),
      ).toThrow("command.admission_closed");
    } finally {
      db.close();
    }
  });

  it("bounds process-wide admission at 128, replays first, and releases terminal capacity", async () => {
    const dir = await tempDir();
    cleanups.push(dir);
    const source = join(dir, "session.jsonl");
    await writeFile(source, "");
    const { db, store } = await openStore(join(dir, "app.sqlite3"));
    addPrincipalWorkspaceSession(store, source);
    store.run(
      "INSERT INTO sessions(session_id,workspace_id,source_path,name,created_at,updated_at) VALUES(?,?,?,?,?,?)",
      "session_2",
      "workspace_1",
      source,
      "Second",
      store.now(),
      store.now(),
    );
    try {
      const coordinator = new RuntimeCoordinator(
        store,
        new EventHub(),
        dir,
        0,
        new ControlledAdapter(),
      );
      const admitted = coordinator.createRun("principal_1", "session_1", body("global_0", "first"));
      for (let index = 1; index < 128; index += 1) {
        store.run(
          "INSERT INTO runs(run_id,session_id,command_id,prompt,profile_json,state,ordinal,retry_of_run_id,failure_code,revision,run_seq,created_at,updated_at) VALUES(?,?,?,?,?,'queued',?,NULL,NULL,1,1,?,?)",
          `seed_${index}`,
          "session_1",
          `seed_command_${index}`,
          "seed",
          JSON.stringify({ modelId: "model_1", thinkingLevel: "off" }),
          index + 1,
          store.now(),
          store.now(),
        );
      }
      expect(coordinator.createRun("principal_1", "session_1", body("global_0", "first"))).toEqual(
        admitted,
      );
      expect(() =>
        coordinator.createRun("principal_1", "session_2", body("global_overflow", "overflow")),
      ).toThrow("run.process_capacity");
      store.run("UPDATE runs SET state='completed' WHERE run_id='seed_1'");
      expect(
        coordinator.createRun("principal_1", "session_2", body("global_released", "released"))
          .state,
      ).toBe("queued");
      await coordinator.close();
    } finally {
      db.close();
    }
  });
});
