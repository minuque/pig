import type {
  EventCursor,
  GatewayEvent,
  RunId,
  SessionId,
  SessionSnapshot,
} from "@no-pi-no-gang/contracts";
import type { QueryClient } from "@tanstack/vue-query";
import type { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import { projectDurableEvent } from "@/features/sync/projector";
import {
  createEmptyLiveOverlay,
  cursorSeq,
  ensureRunOverlay,
  type LiveOverlayState,
  overlayFromPartialOutputs,
  reduceLiveOverlay,
  replaceSessionOverlays,
  withCursor,
} from "@/features/sync/reducer";
import { StreamCoalescer } from "@/features/sync/stream-coalescer";
import type { TranscriptCacheData } from "@/features/sync/transcript-cache";
import type { WebGatewayClient } from "@/lib/gateway/client";
import { setCsrfToken } from "@/lib/gateway/csrf";
import { gatewayKeys } from "@/lib/gateway/keys";
import type { UnknownGatewayEvent } from "@/lib/gateway/sse";

type LiveOverlayStore = ReturnType<typeof useLiveOverlayStore>;

/**
 * Stream resume cursor after recovery: the newest same-epoch sequence
 * covered by the verified snapshots and the bootstrap. A snapshot captured
 * under a different epoch — or behind the bootstrap cursor — makes the
 * staged replacement unsafe, so recovery resets instead of re-reducing
 * events the snapshots already covered.
 */
function recoveryResumeCursor(
  bootstrapCursor: EventCursor,
  snapshotCursors: readonly EventCursor[],
): EventCursor | null {
  const boundary = bootstrapCursor.lastIndexOf(":");
  const bootstrapSeq = cursorSeq(bootstrapCursor);
  if (boundary <= 0 || bootstrapSeq < 0) return null;
  const epoch = bootstrapCursor.slice(0, boundary);
  let maxSeq = bootstrapSeq;
  for (const cursor of snapshotCursors) {
    const seq = cursorSeq(cursor);
    if (seq < bootstrapSeq) return null;
    if (cursor.slice(0, cursor.lastIndexOf(":")) !== epoch) return null;
    if (seq > maxSeq) maxSeq = seq;
  }
  return `${epoch}:${maxSeq}` as EventCursor;
}

export interface GatewaySyncControllerDeps {
  client: WebGatewayClient;
  queryClient: QueryClient;
  store: LiveOverlayStore;
  /** Delta commit coalescing window; 75ms per the streaming contract. */
  coalesceMs?: number;
  /** Backoff before a full resync retry after a fatal failure. */
  resyncDelayMs?: number;
}

/**
 * The unique consumer of the Gateway event stream. It reduces events into the
 * Live Overlay store (coalescing token deltas), projects durable payloads
 * into Vue Query, and recovers from gaps, epoch changes and stream resets by
 * re-capturing bootstrap and replacing overlay state wholesale from verified
 * REST snapshots. No component ever mutates the overlay directly.
 */
export class GatewaySyncController {
  readonly #deps: GatewaySyncControllerDeps;
  readonly #coalescer: StreamCoalescer<LiveOverlayState>;
  #started = false;
  #stopped = false;
  #loopId = 0;
  #streamAbort: AbortController | null = null;
  #resyncPromise: Promise<void> | null = null;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #overlayState: LiveOverlayState;

  constructor(deps: GatewaySyncControllerDeps) {
    this.#deps = deps;
    this.#overlayState = deps.store.overlay;
    this.#coalescer = new StreamCoalescer<LiveOverlayState>(deps.coalesceMs ?? 75, (state) =>
      deps.store.commit(state),
    );
  }

  start(cursor: EventCursor): void {
    if (this.#started) {
      throw new Error("GatewaySyncController is unique per application; start() was called twice");
    }
    this.#started = true;
    void this.#run(cursor, ++this.#loopId);
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    this.#loopId += 1;
    this.#coalescer.dispose();
    if (this.#retryTimer !== null) {
      clearTimeout(this.#retryTimer);
      this.#retryTimer = null;
    }
    this.#streamAbort?.abort();
    await this.#resyncPromise;
  }

  async #run(after: EventCursor | undefined, loopId: number): Promise<void> {
    const abort = new AbortController();
    this.#streamAbort = abort;
    try {
      const stream = this.#deps.client.events.open(after === undefined ? {} : { after }, {
        signal: abort.signal,
      });
      for await (const item of stream) {
        if (this.#stopped || loopId !== this.#loopId) return;
        if (item.kind === "connection") {
          this.#deps.store.setConnection(item.state);
          continue;
        }
        const event = item.event;
        if ("latestCursor" in event) {
          if (event.type === "stream.reset") {
            void this.#resync();
            return;
          }
          continue;
        }
        if (!this.#handle(event)) return;
      }
    } catch {
      if (this.#stopped || abort.signal.aborted || loopId !== this.#loopId) {
        return;
      }
      // Fatal open/transport/decode failure: rebuild from REST truth.
      this.#deps.store.setConnection("reconnecting");
      this.#scheduleResync();
    }
  }

  /** Returns false when the current stream loop must stop (resync pending). */
  #handle(event: GatewayEvent | UnknownGatewayEvent): boolean {
    // Reduce from the latest offered state, not Pinia's last coalesced commit.
    // Otherwise consecutive deltas inside one window overwrite each other.
    const result = reduceLiveOverlay(this.#overlayState, event);
    const effect = result.effect;
    if (effect.kind === "gap" || effect.kind === "epoch-changed") {
      void this.#resync();
      return false;
    }
    this.#overlayState = result.next;
    this.#coalescer.offer(
      result.next,
      effect.kind === "applied" && event.type === "run.output.delta" ? "coalesce" : "immediate",
    );
    if (!("payload" in event)) return true;
    const shouldProject =
      (effect.kind === "ignored" && effect.reason === "durable-only") ||
      (effect.kind === "applied" &&
        (event.type === "run.changed" || event.type === "transcript.item.committed"));
    if (!shouldProject) return true;
    const { terminalRun } = projectDurableEvent(this.#deps.queryClient, event as GatewayEvent);
    if (terminalRun) {
      void this.#retireRunOverlay(terminalRun.sessionId, terminalRun.runId);
    }
    return true;
  }

  /** Load verified durable resources before retiring a terminal overlay. */
  async #retireRunOverlay(sessionId: SessionId, runId: RunId): Promise<void> {
    try {
      const [snapshot, transcript] = await Promise.all([
        this.#deps.client.sessions.snapshot({ sessionId }),
        this.#deps.client.sessions.transcript({ sessionId, limit: 50 }),
      ]);
      if (this.#stopped) return;
      this.#installDurableSnapshot(sessionId, snapshot, {
        items: transcript.items,
        previousCursor: transcript.nextCursor,
        historyTruncated: false,
      });
      this.#overlayState = this.#deps.store.overlay;
      this.#deps.store.dropRun(sessionId, runId);
      this.#overlayState = this.#deps.store.overlay;
    } catch {
      // Keep the overlay until a verified durable replacement can be loaded.
      this.#scheduleResync();
    }
  }

  #scheduleResync(): void {
    if (this.#stopped || this.#retryTimer !== null) return;
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      void this.#resync();
    }, this.#deps.resyncDelayMs ?? 2000);
  }

  /**
   * Full recovery: re-capture bootstrap (fresh cursor + nonterminal Runs),
   * reset the overlay, reseed durable caches, invalidate every query so
   * visible Sessions reinstall verified snapshots, then reopen the stream.
   */
  async #resync(): Promise<void> {
    if (this.#resyncPromise) return this.#resyncPromise;
    this.#streamAbort?.abort();
    this.#coalescer.discard();
    const promise = (async () => {
      try {
        const bootstrap = await this.#deps.client.bootstrap.get();
        if (this.#stopped) return;
        const sessionIds = new Set<SessionId>(
          bootstrap.nonterminalRuns.map((run) => run.sessionId),
        );
        // Snapshot queries represent selected/recently selected Sessions.
        for (const query of this.#deps.queryClient
          .getQueryCache()
          .findAll({ queryKey: [...gatewayKeys.sessions.all, "snapshot"] })) {
          const candidate = query.queryKey[2];
          if (typeof candidate === "string" && candidate !== "__none__") {
            sessionIds.add(candidate as SessionId);
          }
        }
        const snapshots = await Promise.all(
          [...sessionIds].map(async (sessionId) => ({
            sessionId,
            snapshot: await this.#deps.client.sessions.snapshot({ sessionId }),
          })),
        );
        if (this.#stopped) return;

        const resumeCursor = recoveryResumeCursor(
          bootstrap.capturedEventCursor,
          snapshots.map(({ snapshot }) => snapshot.capturedEventCursor),
        );
        if (resumeCursor === null) {
          // Discard the staged capture wholesale; the retry re-captures a
          // consistent bootstrap + snapshot set under one epoch.
          throw new Error("Recovery snapshots diverged from the bootstrap cursor");
        }

        let replacement = withCursor(createEmptyLiveOverlay(), resumeCursor);
        for (const run of bootstrap.nonterminalRuns) {
          replacement = ensureRunOverlay(replacement, run);
        }
        for (const { sessionId, snapshot } of snapshots) {
          replacement = replaceSessionOverlays(
            replacement,
            sessionId,
            overlayFromPartialOutputs(snapshot.partialOutputs),
            snapshot.capturedEventCursor,
          );
          for (const run of [...snapshot.activeRuns, ...snapshot.queuedRuns]) {
            replacement = ensureRunOverlay(replacement, run);
          }
        }

        // All remote reads succeeded; install durable Query truth and the live
        // replacement as one synchronous commit phase.
        setCsrfToken(bootstrap.csrfToken);
        this.#deps.queryClient.setQueryData(gatewayKeys.models, bootstrap.models);
        this.#deps.queryClient.setQueryData(gatewayKeys.providerAuth, bootstrap.providerAuth);
        for (const { sessionId, snapshot } of snapshots) {
          this.#installDurableSnapshot(sessionId, snapshot);
        }
        this.#overlayState = replacement;
        this.#deps.store.commit(replacement);
        if (this.#stopped) return;
        void this.#run(resumeCursor, ++this.#loopId);
      } catch {
        if (this.#stopped) return;
        this.#deps.store.setConnection("reconnecting");
        this.#scheduleResync();
      }
    })();
    this.#resyncPromise = promise;
    try {
      await promise;
    } finally {
      this.#resyncPromise = null;
    }
  }

  #installDurableSnapshot(
    sessionId: SessionId,
    snapshot: SessionSnapshot,
    transcript: TranscriptCacheData = {
      items: snapshot.transcriptTail,
      previousCursor: snapshot.previousTranscriptCursor,
      historyTruncated: snapshot.historyTruncated,
    },
  ): void {
    this.#deps.queryClient.setQueryData(gatewayKeys.sessions.snapshot(sessionId), snapshot);
    this.#deps.queryClient.setQueryData(gatewayKeys.sessions.detail(sessionId), snapshot.session);
    this.#deps.queryClient.setQueryData(gatewayKeys.sessions.transcript(sessionId), transcript);
  }
}
