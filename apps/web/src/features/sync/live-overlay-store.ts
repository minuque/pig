import { shallowRef, ref } from "vue";
import { defineStore } from "pinia";
import type {
  EventCursor,
  RunId,
  RunSummary,
  SessionId,
  SessionSnapshot,
} from "@no-pi-no-gang/contracts";
import {
  createEmptyLiveOverlay,
  cursorSeq,
  ensureRunOverlay,
  overlayFromPartialOutputs,
  removeRunOverlay,
  replaceSessionOverlays,
  withCursor,
  type LiveOverlayState,
} from "@/features/sync/reducer";

export type StreamConnection = "connecting" | "live" | "reconnecting";

/**
 * The Live Overlay store. Sole owner of realtime state reduced from Gateway
 * events; it never persists anything and never overrides Query-owned durable
 * facts. Mutation methods are called exclusively by the Gateway Sync
 * Controller (and by snapshot installation, which replaces state wholesale
 * from a verified REST snapshot).
 */
export const useLiveOverlayStore = defineStore("live-overlay", () => {
  const overlay = shallowRef<LiveOverlayState>(createEmptyLiveOverlay());
  const connection = ref<StreamConnection>("connecting");

  /** Commit a reduced state (called by the Sync Controller). */
  function commit(next: LiveOverlayState): void {
    overlay.value = next;
  }

  function setConnection(state: StreamConnection): void {
    connection.value = state;
  }

  /**
   * Install a verified Session snapshot. Returns true when the snapshot was
   * newer than the currently reduced state and therefore replaced the
   * Session's overlays; false when it was a duplicate or stale install.
   */
  function installSnapshot(
    sessionId: SessionId,
    snapshot: SessionSnapshot,
  ): boolean {
    const seq = cursorSeq(snapshot.capturedEventCursor);
    if (seq < 0) return false;
    const current = overlay.value;
    if (current.sessionWatermarks[sessionId] === seq) return false;
    if (seq < current.lastGatewaySeq) return false;
    const overlays = overlayFromPartialOutputs(snapshot.partialOutputs);
    let next = replaceSessionOverlays(
      current,
      sessionId,
      overlays,
      snapshot.capturedEventCursor,
    );
    for (const run of [...snapshot.activeRuns, ...snapshot.queuedRuns]) {
      next = ensureRunOverlay(next, run);
    }
    overlay.value = next;
    return true;
  }

  /** Drop one Run overlay after its durable boundary landed in Query. */
  function dropRun(sessionId: SessionId, runId: RunId): void {
    overlay.value = removeRunOverlay(overlay.value, sessionId, runId);
  }

  /**
   * Full reset (epoch change / stream reset / gap recovery): the overlay is
   * rebuilt from a freshly captured bootstrap cursor and nonterminal Runs;
   * per-Session overlays are then reinstalled from refetched snapshots.
   */
  function resetAll(
    cursor: EventCursor,
    nonterminalRuns: readonly RunSummary[],
  ): void {
    let next = withCursor(createEmptyLiveOverlay(), cursor);
    for (const run of nonterminalRuns) next = ensureRunOverlay(next, run);
    overlay.value = next;
  }

  return {
    overlay,
    connection,
    commit,
    setConnection,
    installSnapshot,
    dropRun,
    resetAll,
  };
});
