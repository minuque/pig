import type { ExecutionProfile, SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import { computed, onBeforeUnmount, reactive, ref, type ComputedRef, type Ref } from "vue";
import {
  api,
  errorMessage,
  streamEvents,
  type SessionDto,
  type WorkspaceDto,
} from "../../api/index.js";
import { queuePreResponseEvent, terminalStatuses, type UiRun } from "./run-state.js";
import {
  routeSessionEvent,
  sessionKey,
  sessionState,
  type SessionClientState,
} from "../sessions/session-state.js";

export function useRuns(
  workspace: Ref<WorkspaceDto | undefined>,
  currentSession: ComputedRef<SessionDto | undefined>,
  loadTranscript: () => Promise<void>,
) {
  const states = reactive(new Map<string, SessionClientState>());
  const prompt = computed({
    get: () =>
      workspace.value && currentSession.value
        ? sessionState(states, workspace.value.id, currentSession.value.id).draft
        : "",
    set: (value: string) => {
      if (workspace.value && currentSession.value)
        sessionState(states, workspace.value.id, currentSession.value.id).draft = value;
    },
  });
  const runError = ref("");
  const cancelling = ref(new Set<string>());
  const profiles = ref<ExecutionProfile[]>([]);
  const profile = ref<ExecutionProfile>();
  const clientState = computed(() =>
    workspace.value && currentSession.value
      ? sessionState(states, workspace.value.id, currentSession.value.id)
      : undefined,
  );
  const runs = computed(() => clientState.value?.runs ?? new Map<string, UiRun>());
  const queuedEvents = new Map<string, SSEEventEnvelope[]>();
  const sessionRuns = computed(() =>
    [...runs.value.values()].filter(({ sessionId }) => sessionId === currentSession.value?.id),
  );
  const activeRun = computed(() =>
    sessionRuns.value.find(({ status }) => !terminalStatuses.has(status)),
  );
  const eventController = new AbortController();

  function handleEvent(value: unknown) {
    const envelope = value as SSEEventEnvelope;
    const run = routeSessionEvent(states, envelope);
    if (!run) {
      if (
        envelope.workspaceId &&
        envelope.sessionId &&
        envelope.runId &&
        !states.get(sessionKey(envelope.workspaceId, envelope.sessionId))?.runs.has(envelope.runId)
      ) {
        const key = `${envelope.workspaceId}:${envelope.sessionId}:${envelope.runId}`;
        const queue = queuedEvents.get(key) ?? [];
        queuePreResponseEvent(queue, envelope);
        queuedEvents.set(key, queue);
      }
      return;
    }
    if (terminalStatuses.has(run.status) && run.sessionId === currentSession.value?.id)
      void refreshTranscript();
  }
  async function refreshTranscript() {
    await loadTranscript();
    const sessionId = currentSession.value?.id;
    for (const run of runs.value.values())
      if (
        run.sessionId === sessionId &&
        terminalStatuses.has(run.status) &&
        run.status !== "cancelled"
      )
        runs.value.delete(run.id);
  }
  async function recoverAfterReconnect() {
    await loadTranscript();
    for (const state of states.values())
      for (const run of state.runs.values()) {
        if (terminalStatuses.has(run.status)) continue;
        try {
          const result = await api<{ run: UiRun }>(
            `/workspaces/${run.workspaceId}/sessions/${run.sessionId}/runs/${run.id}`,
          );
          Object.assign(run, result.run);
        } catch {
          // A later SSE event or explicit user retry remains authoritative.
        }
      }
  }
  async function startEvents() {
    const capabilities = await api<{ profiles: ExecutionProfile[] }>("/capabilities");
    profiles.value = capabilities.profiles;
    profile.value = profiles.value[0];
    let opened = false;
    let resolveReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    void (async () => {
      for (let attempt = 0; attempt < 3 && !eventController.signal.aborted; attempt++) {
        try {
          await streamEvents(handleEvent, eventController.signal, () => {
            if (!opened) {
              opened = true;
              resolveReady();
            } else void recoverAfterReconnect();
          });
          if (!eventController.signal.aborted) throw new Error("Event stream disconnected");
        } catch (error) {
          if (eventController.signal.aborted) return;
          if (attempt === 2) {
            if (!opened) rejectReady(error);
            runError.value = errorMessage(error);
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    })();
    await ready;
  }
  async function sendPrompt() {
    const workspaceId = workspace.value?.id;
    const sessionId = currentSession.value?.id;
    const text = prompt.value.trim();
    if (!workspaceId || !sessionId || !text) return;
    const state = sessionState(states, workspaceId, sessionId);
    runError.value = "";
    try {
      const { run } = await api<{ run: Omit<UiRun, "output"> & { output?: string } }>(
        `/workspaces/${workspaceId}/sessions/${sessionId}/runs`,
        {
          method: "POST",
          body: JSON.stringify({
            prompt: text,
            commandId: crypto.randomUUID(),
            profile: profile.value,
          }),
        },
      );
      state.runs.set(run.id, { ...run, output: run.output ?? "" });
      state.draft = "";
      const key = `${workspaceId}:${sessionId}:${run.id}`;
      const queued = queuedEvents.get(key) ?? [];
      queuedEvents.delete(key);
      for (const event of queued) handleEvent(event);
    } catch (error) {
      runError.value = errorMessage(error);
    }
  }
  async function cancelRun(run: UiRun) {
    if (terminalStatuses.has(run.status) || cancelling.value.has(run.id)) return;
    cancelling.value.add(run.id);
    runError.value = "";
    try {
      const result = await api<{ run: { status: UiRun["status"] } }>(
        `/workspaces/${run.workspaceId}/sessions/${run.sessionId}/runs/${run.id}/cancel`,
        { method: "POST", body: JSON.stringify({ commandId: crypto.randomUUID() }) },
      );
      run.status = result.run.status;
      await refreshTranscript();
    } catch (error) {
      runError.value = errorMessage(error);
    } finally {
      cancelling.value.delete(run.id);
    }
  }
  async function steerRun(input: string) {
    const run = sessionRuns.value.find(({ status }) => status === "running");
    if (!run || !input.trim()) return;
    runError.value = "";
    try {
      await api(`/workspaces/${run.workspaceId}/sessions/${run.sessionId}/runs/${run.id}/steer`, {
        method: "POST",
        body: JSON.stringify({ input }),
      });
      prompt.value = "";
    } catch (error) {
      runError.value = errorMessage(error);
    }
  }
  onBeforeUnmount(() => eventController.abort());
  return {
    prompt,
    runError,
    cancelling,
    sessionRuns,
    activeRun,
    clientState,
    profiles,
    profile,
    startEvents,
    sendPrompt,
    cancelRun,
    steerRun,
  };
}
