import type { ModelPreset, ModelVendor, SSEEventEnvelope } from "@pig/contracts";
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
  type TranscriptScrollState,
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
  const presets = ref<ModelPreset[]>([]);
  const catalog = ref<ModelVendor[]>([]);
  const preset = ref<ModelPreset>();
  const clientState = computed(() =>
    workspace.value && currentSession.value
      ? sessionState(states, workspace.value.id, currentSession.value.id)
      : undefined,
  );
  // 滚动状态唯一写入入口：TranscriptView 只上报，由这里落到会话状态；
  // 其余写入仅有 sessionState 初始化与 routeSessionEvent 的新活动提示
  function applyScrollState(scroll: TranscriptScrollState) {
    const state = clientState.value;
    if (!state) return;
    state.scrollTop = scroll.scrollTop;
    state.following = scroll.following;
    state.hasNewActivity = scroll.hasNewActivity;
  }
  const runs = computed(() => clientState.value?.runs ?? new Map<string, UiRun>());
  const queuedEvents = new Map<string, SSEEventEnvelope[]>();
  let lastSequence: number | undefined;
  const sessionRuns = computed(() =>
    [...runs.value.values()].filter(({ sessionId }) => sessionId === currentSession.value?.id),
  );
  const activeRun = computed(() =>
    sessionRuns.value.find(({ status }) => !terminalStatuses.has(status)),
  );
  const eventController = new AbortController();

  function handleEvent(value: unknown, replay = false) {
    const envelope = value as SSEEventEnvelope;
    // 预响应事件到达时已推进过 lastSequence，重放时跳过去重（这些事件从未被应用）
    if (!replay && lastSequence !== undefined && envelope.sequence <= lastSequence) {
      return; // ignore old non-replay event
    }
    lastSequence = Math.max(lastSequence ?? 0, envelope.sequence);
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
    const capabilities = await api<{ presets: ModelPreset[]; catalog: ModelVendor[] }>(
      "/capabilities",
    );
    presets.value = capabilities.presets;
    catalog.value = capabilities.catalog;
    preset.value = presets.value[0];
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
          const { gap, latestSequence } = await streamEvents(
            handleEvent,
            eventController.signal,
            (info) => {
              if (!opened) {
                opened = true;
                resolveReady();
              }
            },
            lastSequence,
          );
          if (
            gap ||
            (lastSequence === undefined
              ? false
              : latestSequence !== undefined && latestSequence <= lastSequence)
          ) {
            await recoverAfterReconnect();
          }
          if (latestSequence !== undefined) lastSequence = latestSequence;
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
  async function sendPrompt(override?: string) {
    const workspaceId = workspace.value?.id;
    const sessionId = currentSession.value?.id;
    const text = (override ?? prompt.value).trim();
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
            profile: preset.value,
          }),
        },
      );
      state.runs.set(run.id, { ...run, output: run.output ?? "" });
      state.draft = "";
      const key = `${workspaceId}:${sessionId}:${run.id}`;
      const queued = queuedEvents.get(key) ?? [];
      queuedEvents.delete(key);
      for (const event of queued) handleEvent(event, true);
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
    catalog,
    preset,
    startEvents,
    applyScrollState,
    sendPrompt,
    cancelRun,
    steerRun,
  };
}
