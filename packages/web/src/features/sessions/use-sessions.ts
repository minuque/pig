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
  const navOpen = ref(false);
  const currentSession = computed(() =>
    sessions.value.find(({ id }) => id === route.params.sessionId),
  );
  const transcript = ref<TranscriptEntry[]>([]);
  const loadingTranscript = ref(false);
  const transcriptError = ref("");

  async function loadSessions() {
    if (!workspace.value || loadingSessions.value) return;
    loadingSessions.value = true;
    sessionError.value = "";
    try {
      sessions.value = (
        await api<{ sessions: SessionDto[] }>(`/workspaces/${workspace.value.id}/sessions`)
      ).sessions;
    } catch (error) {
      sessionError.value = errorMessage(error);
    } finally {
      loadingSessions.value = false;
    }
  }
  async function loadTranscript() {
    const workspaceId = workspace.value?.id;
    const sessionId = currentSession.value?.id;
    if (!workspaceId || !sessionId) {
      transcript.value = [];
      return;
    }
    loadingTranscript.value = true;
    transcriptError.value = "";
    try {
      const result = await api<{ transcript: TranscriptEntry[] }>(
        `/workspaces/${workspaceId}/sessions/${sessionId}/transcript`,
      );
      if (currentSession.value?.id === sessionId) transcript.value = result.transcript;
    } catch (error) {
      transcriptError.value = errorMessage(error);
    } finally {
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
  };
}
