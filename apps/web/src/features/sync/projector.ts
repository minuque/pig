import type { GatewayEvent, RunId, SessionId } from "@no-pi-no-gang/contracts";
import type { QueryClient } from "@tanstack/vue-query";
import { isTerminalRunState } from "@/features/sync/reducer";
import { appendCommittedTranscriptItem } from "@/features/sync/transcript-cache";
import { gatewayKeys } from "@/lib/gateway/keys";

/**
 * Durable projector: installs verified SSE payloads into the Vue Query cache
 * (or invalidates the affected keys so a REST refetch restores the truth).
 * Live-only events (deltas, phases) are never projected — they belong to the
 * Live Overlay only.
 *
 * Returns the run-scoped terminal transition, if any, so the Sync Controller
 * can retire the Run's overlay once the durable boundary is in place.
 */
export function projectDurableEvent(
  queryClient: QueryClient,
  event: GatewayEvent,
): { terminalRun?: { sessionId: SessionId; runId: RunId } } {
  switch (event.type) {
    case "workspace.changed": {
      queryClient.setQueryData(gatewayKeys.workspaces.detail(event.workspaceId), event.payload);
      void queryClient.invalidateQueries({
        queryKey: gatewayKeys.workspaces.list(),
      });
      return {};
    }
    case "workspace.removed": {
      void queryClient.invalidateQueries({
        queryKey: gatewayKeys.workspaces.all,
      });
      return {};
    }
    case "session.changed": {
      queryClient.setQueryData(
        gatewayKeys.sessions.detail(event.sessionId),
        (current: Record<string, unknown> | undefined): Record<string, unknown> => ({
          ...current,
          ...event.payload,
        }),
      );
      void queryClient.invalidateQueries({
        queryKey: [...gatewayKeys.sessions.all, "list"],
      });
      return {};
    }
    case "session.removed": {
      void queryClient.invalidateQueries({
        queryKey: gatewayKeys.sessions.all,
      });
      return {};
    }
    case "run.changed": {
      const run = event.payload;
      mergeRunIntoSnapshotCache(queryClient, run);
      void queryClient.invalidateQueries({
        queryKey: gatewayKeys.runs.detail(run.runId),
      });
      if (isTerminalRunState(run.state)) {
        // The controller invalidates the Transcript query and retires the
        // overlay once the durable boundary is in place.
        return {
          terminalRun: { sessionId: run.sessionId, runId: run.runId },
        };
      }
      return {};
    }
    case "transcript.item.committed": {
      const appended = appendCommittedTranscriptItem(queryClient, event.sessionId, event.payload);
      if (!appended) {
        void queryClient.invalidateQueries({
          queryKey: gatewayKeys.sessions.transcript(event.sessionId),
        });
      }
      return {};
    }
    case "models.changed": {
      void queryClient.invalidateQueries({ queryKey: gatewayKeys.models });
      return {};
    }
    case "providerAuth.changed": {
      queryClient.setQueryData(
        gatewayKeys.providerAuth,
        (current: Array<{ providerId: string }> | undefined) => {
          if (!current) return current;
          return current.map((status) =>
            status.providerId === event.payload.providerId ? event.payload : status,
          );
        },
      );
      return {};
    }
    case "authFlow.changed": {
      queryClient.setQueryData(gatewayKeys.authFlow(event.payload.flowId), event.payload);
      return {};
    }
    default: {
      // Live-only events (run.output.delta, run.phase.changed) never project.
      return {};
    }
  }
}

/** Merge a run.changed payload into the cached Session snapshot, if any. */
function mergeRunIntoSnapshotCache(
  queryClient: QueryClient,
  run: Extract<GatewayEvent, { type: "run.changed" }>["payload"],
): void {
  interface SnapshotShape {
    activeRuns: Array<{ runId: string }>;
    queuedRuns: Array<{ runId: string }>;
  }
  queryClient.setQueryData<SnapshotShape>(
    gatewayKeys.sessions.snapshot(run.sessionId),
    (current) => {
      if (!current) return current;
      const without = {
        ...current,
        activeRuns: current.activeRuns.filter((r) => r.runId !== run.runId),
        queuedRuns: current.queuedRuns.filter((r) => r.runId !== run.runId),
      };
      if (isTerminalRunState(run.state)) return without;
      if (run.state === "queued") {
        return { ...without, queuedRuns: [...without.queuedRuns, run] };
      }
      return { ...without, activeRuns: [run] };
    },
  );
}
