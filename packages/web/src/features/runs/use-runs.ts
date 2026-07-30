import type { SSEEventEnvelope } from "@no-pi-no-gang/contracts";
import { computed, onBeforeUnmount, reactive, ref, type ComputedRef, type Ref } from "vue";
import {
  api,
  errorMessage,
  streamEvents,
  type SessionDto,
  type WorkspaceDto,
} from "../../api/index.js";
import { routeRunEvent, terminalStatuses, type UiRun } from "./run-state.js";

export function useRuns(
  workspace: Ref<WorkspaceDto | undefined>,
  currentSession: ComputedRef<SessionDto | undefined>,
  loadTranscript: () => Promise<void>,
) {
  const prompt = ref("");
  const runError = ref("");
  const cancelling = ref(false);
  const runs = reactive(new Map<string, UiRun>());
  const queuedEvents: SSEEventEnvelope[] = [];
  const sessionRuns = computed(() =>
    [...runs.values()].filter(({ sessionId }) => sessionId === currentSession.value?.id),
  );
  const activeRun = computed(() =>
    sessionRuns.value.find(({ status }) => !terminalStatuses.has(status)),
  );
  const eventController = new AbortController();

  function handleEvent(value: unknown) {
    const envelope = value as SSEEventEnvelope;
    const run = routeRunEvent(runs, envelope);
    if (!run) {
      if (envelope.sessionId === currentSession.value?.id && queuedEvents.length < 50)
        queuedEvents.push(envelope);
      return;
    }
    if (terminalStatuses.has(run.status) && run.sessionId === currentSession.value?.id)
      void refreshTranscript();
  }
  async function refreshTranscript() {
    await loadTranscript();
    const sessionId = currentSession.value?.id;
    for (const run of runs.values())
      if (run.sessionId === sessionId && terminalStatuses.has(run.status)) runs.delete(run.id);
  }
  async function startEvents() {
    void streamEvents(handleEvent, eventController.signal).catch((error) => {
      if (!eventController.signal.aborted) runError.value = errorMessage(error);
    });
  }
  async function sendPrompt() {
    const workspaceId = workspace.value?.id;
    const sessionId = currentSession.value?.id;
    const text = prompt.value.trim();
    if (!workspaceId || !sessionId || !text || activeRun.value) return;
    runError.value = "";
    try {
      const { run } = await api<{ run: Omit<UiRun, "output"> & { output?: string } }>(
        `/workspaces/${workspaceId}/sessions/${sessionId}/runs`,
        { method: "POST", body: JSON.stringify({ prompt: text, commandId: crypto.randomUUID() }) },
      );
      runs.set(run.id, { ...run, output: run.output ?? "" });
      prompt.value = "";
      for (const event of queuedEvents.splice(0)) handleEvent(event);
    } catch (error) {
      runError.value = errorMessage(error);
    }
  }
  async function cancelRun() {
    const run = activeRun.value;
    if (!run || cancelling.value) return;
    cancelling.value = true;
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
      cancelling.value = false;
    }
  }
  onBeforeUnmount(() => eventController.abort());
  return {
    prompt,
    runError,
    cancelling,
    sessionRuns,
    activeRun,
    startEvents,
    sendPrompt,
    cancelRun,
  };
}
