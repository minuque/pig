import type { TranscriptEntry } from "@no-pi-no-gang/contracts";
import { computed, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage, type SessionDto, type WorkspaceDto } from "../../api/index.js";

export function useSessions(workspace: Ref<WorkspaceDto | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const sessions = ref<SessionDto[]>([]);
  const loadingSessions = ref(false);
  const creating = ref(false);
  const sessionError = ref("");
  const nextCursor = ref<string>();
  const navOpen = ref(false);
  const currentSession = computed(() =>
    sessions.value.find(({ id }) => id === route.params.sessionId),
  );
  const transcript = ref<TranscriptEntry[]>([]);
  const loadingTranscript = ref(false);
  const transcriptError = ref("");
  let sessionsGeneration = 0;
  let loadingRequests = 0;

  async function loadSessions(append = false) {
    const workspaceId = workspace.value?.id;
    if (!workspaceId) return;
    const generation = sessionsGeneration;
    loadingRequests++;
    loadingSessions.value = true;
    sessionError.value = "";
    try {
      const page = await api<{ sessions: SessionDto[]; nextCursor?: string }>(
        `/workspaces/${workspaceId}/sessions?limit=25${append && nextCursor.value ? `&cursor=${encodeURIComponent(nextCursor.value)}` : ""}`,
      );
      if (generation !== sessionsGeneration || workspace.value?.id !== workspaceId) return;
      sessions.value = append ? [...sessions.value, ...page.sessions] : page.sessions;
      nextCursor.value = page.nextCursor;
    } catch (error) {
      if (generation === sessionsGeneration) sessionError.value = errorMessage(error);
    } finally {
      loadingRequests--;
      loadingSessions.value = loadingRequests > 0;
    }
  }
  async function loadTranscript() {
    const workspaceId = workspace.value?.id;
    const sessionId = currentSession.value?.id;
    if (!workspaceId || !sessionId) {
      transcript.value = [];
      return;
    }
    transcript.value = [];
    loadingTranscript.value = true;
    transcriptError.value = "";
    try {
      const result = await api<{ transcript: TranscriptEntry[] }>(
        `/workspaces/${workspaceId}/sessions/${sessionId}/transcript`,
      );
      if (workspace.value?.id === workspaceId && currentSession.value?.id === sessionId)
        transcript.value = result.transcript;
    } catch (error) {
      if (workspace.value?.id === workspaceId && currentSession.value?.id === sessionId)
        transcriptError.value = errorMessage(error);
    } finally {
      if (workspace.value?.id === workspaceId && currentSession.value?.id === sessionId)
        loadingTranscript.value = false;
    }
  }
  async function createSession() {
    if (!workspace.value || creating.value) return;
    creating.value = true;
    sessionError.value = "";
    try {
      const { session } = await api<{ session: SessionDto }>(
        `/workspaces/${workspace.value.id}/sessions`,
        { method: "POST", body: JSON.stringify({ commandId: crypto.randomUUID() }) },
      );
      sessions.value = [session, ...sessions.value.filter(({ id }) => id !== session.id)];
      await router.push(`/sessions/${session.id}`);
      navOpen.value = false;
    } catch (error) {
      sessionError.value = errorMessage(error);
    } finally {
      creating.value = false;
    }
  }
  async function renameSession() {
    if (!workspace.value || !currentSession.value) return;
    const name = prompt("Session 名称", currentSession.value.name ?? "");
    if (!name?.trim()) return;
    const { session } = await api<{ session: SessionDto }>(
      `/workspaces/${workspace.value.id}/sessions/${currentSession.value.id}`,
      { method: "PATCH", body: JSON.stringify({ name, confirm: true }) },
    );
    Object.assign(currentSession.value, session);
  }
  async function deleteSession() {
    if (!workspace.value || !currentSession.value || !confirm("删除此 Session 的本地索引？"))
      return;
    await api(`/workspaces/${workspace.value.id}/sessions/${currentSession.value.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    });
    sessions.value = sessions.value.filter(({ id }) => id !== currentSession.value?.id);
    await router.push("/");
  }
  watch(
    () => workspace.value?.id,
    async () => {
      sessionsGeneration++;
      sessions.value = [];
      nextCursor.value = undefined;
      transcript.value = [];
      if (route.params.sessionId) await router.push("/");
    },
    { flush: "sync" },
  );
  watch(
    () => [workspace.value?.id, currentSession.value?.id],
    () => void loadTranscript(),
  );
  return {
    sessions,
    loadingSessions,
    creating,
    sessionError,
    navOpen,
    currentSession,
    transcript,
    loadingTranscript,
    transcriptError,
    loadSessions,
    loadTranscript,
    createSession,
    nextCursor,
    renameSession,
    deleteSession,
  };
}
