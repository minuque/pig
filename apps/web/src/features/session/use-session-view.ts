import { computed, watch, type ComputedRef, type Ref } from "vue";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import type {
  RunState,
  RunSummary,
  SessionDetail,
  SessionId,
  TranscriptItem,
} from "@no-pi-no-gang/contracts";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { gatewayKeys } from "@/lib/gateway/keys";
import {
  isTerminalRunState,
  type LivePhase,
  type LiveRunState,
} from "@/features/sync/reducer";
import { useLiveOverlayStore } from "@/features/sync/live-overlay-store";
import {
  prependOlderTranscriptPage,
  seedTranscriptFromSnapshot,
  transcriptCacheFromPage,
  type TranscriptCacheData,
} from "@/features/sync/transcript-cache";

/**
 * One rendered Transcript entry: either a durable item owned by Vue Query or
 * the Live Overlay of a nonterminal Run. The two sources never mix — live
 * entries are appended after durable ones and disappear when the Run's
 * durable boundary lands.
 */
export type TranscriptEntry =
  | { kind: "durable"; key: string; item: TranscriptItem }
  | {
      kind: "live";
      key: string;
      run: LiveRunState;
      runState: RunState | null;
    };

const PHASE_LABELS: Record<LivePhase, string> = {
  queued: "排队中",
  thinking: "思考中",
  streaming: "正在输出",
  tool: "正在使用工具",
  settling: "正在收尾",
  terminal: "已结束",
};

const RUN_STATE_LABELS: Record<RunState, string> = {
  queued: "排队中",
  starting: "启动中",
  running: "运行中",
  cancelling: "取消中",
  completed: "已完成",
  failed: "已失败",
  cancelled: "已取消",
  interrupted: "已中断",
};

export function runStateLabel(state: RunState): string {
  return RUN_STATE_LABELS[state];
}

export interface SessionView {
  session: ComputedRef<SessionDetail | null>;
  snapshotPending: ComputedRef<boolean>;
  snapshotError: ComputedRef<Error | null>;
  entries: ComputedRef<TranscriptEntry[]>;
  activeRun: ComputedRef<RunSummary | null>;
  queuedRuns: ComputedRef<RunSummary[]>;
  transcriptPending: ComputedRef<boolean>;
  transcriptError: ComputedRef<Error | null>;
  canLoadOlder: ComputedRef<boolean>;
  historyTruncated: ComputedRef<boolean>;
  liveAnnouncement: ComputedRef<string>;
  loadOlder: () => Promise<void>;
}

/**
 * Composes the Session view: durable facts come from Vue Query (snapshot +
 * transcript, both re-fetchable via REST), realtime state from the Pinia Live
 * Overlay installed by the unique Sync Controller. Verified snapshots replace
 * the Session's overlays and seed the transcript cache exactly once per
 * captured cursor.
 */
export function useSessionView(
  sessionId: Ref<SessionId | undefined>,
): SessionView {
  const client = useGatewayClient();
  const queryClient = useQueryClient();
  const overlayStore = useLiveOverlayStore();

  const snapshotQuery = useQuery({
    queryKey: computed(() =>
      gatewayKeys.sessions.snapshot(
        sessionId.value ?? ("__none__" as SessionId),
      ),
    ),
    queryFn: () => {
      const id = sessionId.value;
      if (id === undefined) throw new Error("sessionId is required");
      return client.sessions.snapshot({ sessionId: id });
    },
    enabled: computed(() => sessionId.value !== undefined),
  });

  const transcriptQuery = useQuery({
    queryKey: computed(() =>
      gatewayKeys.sessions.transcript(
        sessionId.value ?? ("__none__" as SessionId),
      ),
    ),
    queryFn: async (): Promise<TranscriptCacheData> => {
      const id = sessionId.value;
      if (id === undefined) throw new Error("sessionId is required");
      const page = await client.sessions.transcript({
        sessionId: id,
        limit: 50,
      });
      return transcriptCacheFromPage(page);
    },
    enabled: computed(() => sessionId.value !== undefined),
  });

  watch(
    () => snapshotQuery.data.value,
    (snapshot) => {
      const id = sessionId.value;
      if (!snapshot || id === undefined) return;
      if (snapshot.session.sessionId !== id) return;
      const installed = overlayStore.installSnapshot(id, snapshot);
      const hasTranscriptCache =
        queryClient.getQueryData(gatewayKeys.sessions.transcript(id)) !==
        undefined;
      if (installed || !hasTranscriptCache) {
        seedTranscriptFromSnapshot(queryClient, id, snapshot);
      }
    },
    { immediate: true },
  );

  const session = computed<SessionDetail | null>(
    () => snapshotQuery.data.value?.session ?? null,
  );
  const activeRun = computed<RunSummary | null>(
    () => snapshotQuery.data.value?.activeRuns[0] ?? null,
  );
  const queuedRuns = computed<RunSummary[]>(
    () => snapshotQuery.data.value?.queuedRuns ?? [],
  );

  const entries = computed<TranscriptEntry[]>(() => {
    const id = sessionId.value;
    if (id === undefined) return [];
    const result: TranscriptEntry[] = (
      transcriptQuery.data.value?.items ?? []
    ).map((item) => ({
      kind: "durable",
      key: `d:${item.entryId}`,
      item,
    }));
    const overlays = overlayStore.overlay.bySession[id] ?? {};
    const knownRuns = [
      ...(activeRun.value ? [activeRun.value] : []),
      ...queuedRuns.value,
    ];
    for (const run of Object.values(overlays)) {
      if (
        run.text === "" &&
        run.thinking === "" &&
        run.toolOrder.length === 0
      ) {
        continue;
      }
      const summary = knownRuns.find(
        (candidate) => candidate.runId === run.runId,
      );
      if (summary && isTerminalRunState(summary.state)) continue;
      result.push({
        kind: "live",
        key: `l:${run.runId}`,
        run,
        runState: summary?.state ?? null,
      });
    }
    return result;
  });

  const liveAnnouncement = computed<string>(() => {
    const run = activeRun.value;
    if (!run) return "";
    const id = sessionId.value;
    const overlay =
      id === undefined
        ? undefined
        : overlayStore.overlay.bySession[id]?.[run.runId];
    if (isTerminalRunState(run.state)) {
      return `Run ${RUN_STATE_LABELS[run.state]}`;
    }
    if (overlay?.phase) {
      return `Run ${PHASE_LABELS[overlay.phase]}`;
    }
    return `Run ${RUN_STATE_LABELS[run.state]}`;
  });

  const canLoadOlder = computed(
    () => (transcriptQuery.data.value?.previousCursor ?? null) !== null,
  );

  const historyTruncated = computed(
    () => transcriptQuery.data.value?.historyTruncated ?? false,
  );

  async function loadOlder(): Promise<void> {
    const id = sessionId.value;
    const previous = transcriptQuery.data.value?.previousCursor ?? null;
    if (id === undefined || previous === null) return;
    const page = await client.sessions.transcript({
      sessionId: id,
      cursor: previous,
      limit: 50,
    });
    prependOlderTranscriptPage(queryClient, id, page);
  }

  return {
    session,
    snapshotPending: computed(() => snapshotQuery.isPending.value),
    snapshotError: computed(() => snapshotQuery.error.value),
    entries,
    activeRun,
    queuedRuns,
    transcriptPending: computed(() => transcriptQuery.isPending.value),
    transcriptError: computed(() => transcriptQuery.error.value),
    canLoadOlder,
    historyTruncated,
    liveAnnouncement,
    loadOlder,
  };
}
