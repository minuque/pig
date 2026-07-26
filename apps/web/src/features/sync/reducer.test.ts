import { describe, expect, it } from "vitest";
import type { GatewayEvent } from "@no-pi-no-gang/contracts";
import {
  createEmptyLiveOverlay,
  overlayFromPartialOutputs,
  reduceLiveOverlay,
  replaceSessionOverlays,
  withCursor,
} from "@/features/sync/reducer";

const emittedAt = "2025-01-02T03:04:05.000Z";

interface DeltaInput {
  seq: number;
  runSeq?: number;
  sessionId?: string;
  runId?: string;
  text?: string;
  epoch?: string;
}

function delta(input: DeltaInput): GatewayEvent {
  return {
    schemaVersion: 1,
    contractRevision: 1,
    type: "run.output.delta",
    gatewayEpoch: input.epoch ?? "epoch_1",
    gatewaySeq: input.seq,
    emittedAt,
    workspaceId: "workspace_1",
    sessionId: input.sessionId ?? "session_1",
    runId: input.runId ?? "run_1",
    runSeq: input.runSeq ?? input.seq,
    payload: {
      operation: "append",
      target: "text",
      text: input.text ?? "x",
    },
  } as unknown as GatewayEvent;
}

describe("reduceLiveOverlay ordering", () => {
  it("applies the first event and advances the cursor", () => {
    const result = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    );
    expect(result.effect).toEqual({ kind: "applied" });
    expect(result.next.cursor).toBe("epoch_1:1");
    expect(result.next.bySession["session_1"]?.["run_1"]?.text).toBe("x");
  });

  it("ignores duplicate cursors without doubling state", () => {
    const first = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    );
    const second = reduceLiveOverlay(first.next, delta({ seq: 1 }));
    expect(second.effect).toEqual({
      kind: "ignored",
      reason: "duplicate-cursor",
    });
    expect(second.next).toBe(first.next);
    expect(second.next.bySession["session_1"]?.["run_1"]?.text).toBe("x");
  });

  it("ignores stale cursors below the watermark", () => {
    let state = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    ).next;
    state = reduceLiveOverlay(state, delta({ seq: 2, text: "y" })).next;
    const stale = reduceLiveOverlay(state, delta({ seq: 1 }));
    expect(stale.effect).toEqual({ kind: "ignored", reason: "stale-cursor" });
    expect(stale.next).toBe(state);
  });

  it("reports gateway sequence gaps with expected and received", () => {
    const state = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    ).next;
    const gap = reduceLiveOverlay(state, delta({ seq: 3 }));
    expect(gap.effect).toEqual({
      kind: "gap",
      scope: "gateway",
      expected: 2,
      received: 3,
    });
    expect(gap.next).toBe(state);
  });

  it("reports epoch changes without mutating state", () => {
    const state = withCursor(createEmptyLiveOverlay(), "epoch_1:1" as never);
    const changed = reduceLiveOverlay(
      state,
      delta({ seq: 2, epoch: "epoch_2" }),
    );
    expect(changed.effect).toEqual({
      kind: "epoch-changed",
      previous: "epoch_1",
      received: "epoch_2",
    });
    expect(changed.next).toBe(state);
  });

  it("keeps overlays isolated per session under a shared cursor", () => {
    let state = createEmptyLiveOverlay();
    state = reduceLiveOverlay(state, delta({ seq: 1, text: "a" })).next;
    state = reduceLiveOverlay(
      state,
      delta({ seq: 2, sessionId: "session_2", runId: "run_2", text: "b" }),
    ).next;
    state = reduceLiveOverlay(
      state,
      delta({ seq: 3, runSeq: 2, text: "c" }),
    ).next;
    expect(state.cursor).toBe("epoch_1:3");
    expect(state.bySession["session_1"]?.["run_1"]?.text).toBe("ac");
    expect(state.bySession["session_2"]?.["run_2"]?.text).toBe("b");
  });

  it("ignores duplicate run sequences", () => {
    let state = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    ).next;
    const dup = reduceLiveOverlay(state, delta({ seq: 2, runSeq: 1 }));
    expect(dup.effect).toEqual({
      kind: "ignored",
      reason: "duplicate-run-seq",
    });
    expect(dup.next.bySession["session_1"]?.["run_1"]?.text).toBe("x");
  });

  it("reports run sequence gaps scoped to the run", () => {
    const state = reduceLiveOverlay(
      createEmptyLiveOverlay(),
      delta({ seq: 1 }),
    ).next;
    const gap = reduceLiveOverlay(state, delta({ seq: 2, runSeq: 3 }));
    expect(gap.effect).toEqual({
      kind: "gap",
      scope: "run",
      sessionId: "session_1",
      runId: "run_1",
      expected: 2,
      received: 3,
    });
  });
});

describe("snapshot watermarks", () => {
  it("advances the cursor over snapshot-covered events without applying them", () => {
    let state = withCursor(createEmptyLiveOverlay(), "epoch_1:4" as never);
    state = replaceSessionOverlays(
      state,
      "session_1" as never,
      {},
      "epoch_1:6" as never,
    );
    const covered = reduceLiveOverlay(state, delta({ seq: 5, text: "z" }));
    expect(covered.effect).toEqual({
      kind: "ignored",
      reason: "covered-by-snapshot",
    });
    expect(covered.next.cursor).toBe("epoch_1:5");
    expect(covered.next.bySession["session_1"]?.["run_1"]).toBeUndefined();
    const beyond = reduceLiveOverlay(
      covered.next,
      delta({ seq: 6, text: "z" }),
    );
    expect(beyond.effect).toEqual({
      kind: "ignored",
      reason: "covered-by-snapshot",
    });
    const fresh = reduceLiveOverlay(beyond.next, delta({ seq: 7, text: "z" }));
    expect(fresh.effect).toEqual({ kind: "applied" });
  });

  it("accepts a sealed run's first streamed event at face value", () => {
    let state = withCursor(createEmptyLiveOverlay(), "epoch_1:6" as never);
    const overlays = overlayFromPartialOutputs([
      { runId: "run_1", text: "hi", thinking: "", tools: [] } as never,
    ]);
    state = replaceSessionOverlays(
      state,
      "session_1" as never,
      overlays,
      "epoch_1:6" as never,
    );
    const applied = reduceLiveOverlay(
      state,
      delta({ seq: 7, runSeq: 42, text: "!" }),
    );
    expect(applied.effect).toEqual({ kind: "applied" });
    const run = applied.next.bySession["session_1"]?.["run_1"];
    expect(run?.text).toBe("hi!");
    expect(run?.lastRunSeq).toBe(42);
  });
});
