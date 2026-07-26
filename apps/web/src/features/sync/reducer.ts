import type {
  EventCursor,
  GatewayEvent,
  PartialRunOutput,
  RunId,
  RunSummary,
  SessionId,
} from "@no-pi-no-gang/contracts";
import type { UnknownGatewayEvent } from "@/lib/gateway/sse";

/**
 * Framework-free Live Overlay reducer. No Vue, Pinia, Query, EventSource, or
 * component imports — pure state in, pure state out.
 *
 * Ordering guarantees:
 * - gatewaySeq is strictly +1 per applied event; duplicates/stale are ignored,
 *   gaps and epoch mismatches are reported so the Sync Controller can resync.
 * - runSeq is strictly +1 within a Run, except for Runs freshly installed from
 *   a verified snapshot (`snapshotSealed`), whose first streamed event is
 *   accepted at face value because snapshots carry no runSeq.
 * - A per-Session watermark records the gatewaySeq covered by the latest
 *   installed snapshot; events at or below it advance the cursor without
 *   mutating overlay state (the snapshot already contains them).
 */

export type LivePhase = "queued" | "thinking" | "streaming" | "tool" | "settling" | "terminal";

export interface LiveToolProgress {
  callId: string;
  status: string;
  summary?: string;
}

export interface LiveRunState {
  runId: RunId;
  lastRunSeq: number;
  text: string;
  thinking: string;
  tools: Record<string, LiveToolProgress>;
  toolOrder: string[];
  phase: LivePhase | null;
  /** True for Runs installed from a snapshot until their first streamed event. */
  snapshotSealed?: boolean;
}

export type SessionOverlays = Record<string, LiveRunState>;

export interface LiveOverlayState {
  cursor: EventCursor | null;
  gatewayEpoch: string | null;
  lastGatewaySeq: number;
  bySession: Record<string, SessionOverlays>;
  /** sessionId -> gatewaySeq already covered by an installed snapshot. */
  sessionWatermarks: Record<string, number>;
}

export type ReduceEffect =
  | { kind: "applied" }
  | {
      kind: "ignored";
      reason:
        | "duplicate-cursor"
        | "stale-cursor"
        | "duplicate-run-seq"
        | "unknown-event"
        | "durable-only"
        | "covered-by-snapshot";
    }
  | {
      kind: "gap";
      scope: "gateway" | "run";
      sessionId?: SessionId;
      runId?: RunId;
      expected: number;
      received: number;
    }
  | { kind: "epoch-changed"; previous: string | null; received: string };

export interface ReduceResult {
  next: LiveOverlayState;
  effect: ReduceEffect;
}

export function createEmptyLiveOverlay(): LiveOverlayState {
  return {
    cursor: null,
    gatewayEpoch: null,
    lastGatewaySeq: 0,
    bySession: {},
    sessionWatermarks: {},
  };
}

/** Numeric gateway sequence of an event cursor (`epoch:seq`). */
export function cursorSeq(cursor: EventCursor): number {
  const index = cursor.lastIndexOf(":");
  const seq = Number(cursor.slice(index + 1));
  return Number.isSafeInteger(seq) && seq >= 0 ? seq : -1;
}

/** Install an externally captured cursor (bootstrap / snapshot boundary). */
export function withCursor(state: LiveOverlayState, cursor: EventCursor): LiveOverlayState {
  const seq = cursorSeq(cursor);
  if (seq < 0) return state;
  return {
    ...state,
    cursor,
    gatewayEpoch: cursor.slice(0, cursor.lastIndexOf(":")),
    lastGatewaySeq: seq,
  };
}

function makeRun(runId: RunId, runSeq: number): LiveRunState {
  return {
    runId,
    lastRunSeq: runSeq,
    text: "",
    thinking: "",
    tools: {},
    toolOrder: [],
    phase: null,
  };
}

function upsertRun(
  state: LiveOverlayState,
  sessionId: SessionId,
  runId: RunId,
  runSeq: number,
  mutate: (run: LiveRunState) => LiveRunState,
): { state: LiveOverlayState; run: LiveRunState } {
  const session = state.bySession[sessionId] ?? {};
  const existing = session[runId];
  const run = mutate(existing ? { ...existing } : makeRun(runId, runSeq));
  return {
    state: {
      ...state,
      bySession: {
        ...state.bySession,
        [sessionId]: { ...session, [runId]: run },
      },
    },
    run,
  };
}

const RUN_SCOPED_TYPES = new Set([
  "run.changed",
  "run.output.delta",
  "run.phase.changed",
  "transcript.item.committed",
]);

const TERMINAL_RUN_STATES = new Set(["completed", "failed", "cancelled", "interrupted"]);

export function isTerminalRunState(state: string): boolean {
  return TERMINAL_RUN_STATES.has(state);
}

export function reduceLiveOverlay(
  previous: LiveOverlayState,
  event: GatewayEvent | UnknownGatewayEvent,
): ReduceResult {
  const { gatewayEpoch, gatewaySeq } = event;

  if (previous.gatewayEpoch !== null && gatewayEpoch !== previous.gatewayEpoch) {
    return {
      next: previous,
      effect: {
        kind: "epoch-changed",
        previous: previous.gatewayEpoch,
        received: gatewayEpoch,
      },
    };
  }
  if (previous.cursor !== null) {
    if (gatewaySeq <= previous.lastGatewaySeq) {
      return {
        next: previous,
        effect: {
          kind: "ignored",
          reason: gatewaySeq === previous.lastGatewaySeq ? "duplicate-cursor" : "stale-cursor",
        },
      };
    }
    if (gatewaySeq > previous.lastGatewaySeq + 1) {
      return {
        next: previous,
        effect: {
          kind: "gap",
          scope: "gateway",
          expected: previous.lastGatewaySeq + 1,
          received: gatewaySeq,
        },
      };
    }
  }

  const cursor = `${gatewayEpoch}:${gatewaySeq}` as EventCursor;
  const advanced: LiveOverlayState = {
    ...previous,
    cursor,
    gatewayEpoch,
    lastGatewaySeq: gatewaySeq,
  };

  // Unknown future event types carry only the envelope; cursor-relevant only.
  if (!("payload" in event)) {
    return {
      next: advanced,
      effect: { kind: "ignored", reason: "unknown-event" },
    };
  }

  // Session watermark: events already covered by an installed snapshot only
  // advance the cursor. Projection of their durable payloads happens via the
  // snapshot itself, so the controller skips them too.
  if ("sessionId" in event) {
    const watermark = previous.sessionWatermarks[event.sessionId];
    if (watermark !== undefined && gatewaySeq <= watermark) {
      return {
        next: advanced,
        effect: { kind: "ignored", reason: "covered-by-snapshot" },
      };
    }
  }

  if (!RUN_SCOPED_TYPES.has(event.type)) {
    return {
      next: advanced,
      effect: { kind: "ignored", reason: "durable-only" },
    };
  }

  const scoped = event as Extract<GatewayEvent, { runId: RunId; runSeq: number }>;
  const { sessionId, runId, runSeq } = scoped;
  const session = previous.bySession[sessionId] ?? {};
  const existingRun = session[runId];
  if (existingRun && !existingRun.snapshotSealed) {
    if (runSeq <= existingRun.lastRunSeq) {
      return {
        next: previous,
        effect: { kind: "ignored", reason: "duplicate-run-seq" },
      };
    }
    if (runSeq > existingRun.lastRunSeq + 1) {
      return {
        next: previous,
        effect: {
          kind: "gap",
          scope: "run",
          sessionId,
          runId,
          expected: existingRun.lastRunSeq + 1,
          received: runSeq,
        },
      };
    }
  }

  switch (scoped.type) {
    case "run.output.delta": {
      const payload = scoped.payload;
      const { state } = upsertRun(advanced, sessionId, runId, runSeq, (run) => {
        const next: LiveRunState = {
          ...run,
          lastRunSeq: runSeq,
          snapshotSealed: false,
        };
        if (payload.operation === "append") {
          if (payload.target === "text") next.text = run.text + payload.text;
          else next.thinking = run.thinking + payload.text;
          return next;
        }
        const progress: LiveToolProgress = {
          callId: payload.callId,
          status: payload.status,
          ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
        };
        return {
          ...next,
          tools: { ...run.tools, [payload.callId]: progress },
          toolOrder: run.toolOrder.includes(payload.callId)
            ? run.toolOrder
            : [...run.toolOrder, payload.callId],
        };
      });
      return { next: state, effect: { kind: "applied" } };
    }
    case "run.phase.changed": {
      const { state } = upsertRun(advanced, sessionId, runId, runSeq, (run) => ({
        ...run,
        lastRunSeq: runSeq,
        snapshotSealed: false,
        phase: scoped.payload.phase,
      }));
      return { next: state, effect: { kind: "applied" } };
    }
    case "run.changed": {
      const runState = scoped.payload.state;
      const { state } = upsertRun(advanced, sessionId, runId, runSeq, (run) => ({
        ...run,
        lastRunSeq: runSeq,
        snapshotSealed: false,
        phase:
          runState === "queued" ? "queued" : isTerminalRunState(runState) ? "terminal" : run.phase,
      }));
      return { next: state, effect: { kind: "applied" } };
    }
    case "transcript.item.committed": {
      const { state } = upsertRun(advanced, sessionId, runId, runSeq, (run) => ({
        ...run,
        lastRunSeq: runSeq,
        snapshotSealed: false,
      }));
      return { next: state, effect: { kind: "applied" } };
    }
  }
}

/** Replace one Session's overlays wholesale from a verified snapshot. */
export function overlayFromPartialOutputs(
  partialOutputs: readonly PartialRunOutput[],
): SessionOverlays {
  const runs: SessionOverlays = {};
  for (const partial of partialOutputs) {
    const tools: Record<string, LiveToolProgress> = {};
    const toolOrder: string[] = [];
    for (const tool of partial.tools) {
      tools[tool.callId] = {
        callId: tool.callId,
        status: tool.status,
        ...(tool.summary !== undefined ? { summary: tool.summary } : {}),
      };
      toolOrder.push(tool.callId);
    }
    runs[partial.runId] = {
      runId: partial.runId,
      lastRunSeq: 0,
      text: partial.text,
      thinking: partial.thinking,
      tools,
      toolOrder,
      phase: null,
    };
  }
  return runs;
}

/**
 * Install a verified Session snapshot: overlays are replaced wholesale, all
 * Runs are sealed (their first streamed event sets a fresh runSeq baseline),
 * and the Session watermark records which gatewaySeq the snapshot covers.
 */
export function replaceSessionOverlays(
  state: LiveOverlayState,
  sessionId: SessionId,
  overlays: SessionOverlays,
  snapshotCursor: EventCursor,
): LiveOverlayState {
  const sealed: SessionOverlays = {};
  for (const [runId, run] of Object.entries(overlays)) {
    sealed[runId] = { ...run, snapshotSealed: true };
  }
  return {
    ...state,
    bySession: { ...state.bySession, [sessionId]: sealed },
    sessionWatermarks: {
      ...state.sessionWatermarks,
      [sessionId]: cursorSeq(snapshotCursor),
    },
  };
}

/** Remove a Run overlay once its durable boundary is installed in Query. */
export function removeRunOverlay(
  state: LiveOverlayState,
  sessionId: SessionId,
  runId: RunId,
): LiveOverlayState {
  const session = state.bySession[sessionId];
  if (!session || !(runId in session)) return state;
  const nextSession = { ...session };
  delete nextSession[runId];
  return {
    ...state,
    bySession: { ...state.bySession, [sessionId]: nextSession },
  };
}

/** Seed empty overlays for known nonterminal Runs lacking live state. */
export function ensureRunOverlay(state: LiveOverlayState, run: RunSummary): LiveOverlayState {
  const session = state.bySession[run.sessionId] ?? {};
  if (session[run.runId]) return state;
  const seeded = makeRun(run.runId, 0);
  seeded.phase = run.state === "queued" ? "queued" : null;
  return {
    ...state,
    bySession: {
      ...state.bySession,
      [run.sessionId]: { ...session, [run.runId]: seeded },
    },
  };
}
