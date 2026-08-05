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
  let transcriptGeneration = 0;

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
      // 深链恢复：URL 指向的 Session 不在当前页时单独拉取
      const deep = route.params.sessionId as string | undefined;
      if (deep && !sessions.value.some(({ id }) => id === deep)) {
        try {
          const { session } = await api<{ session: SessionDto }>(
            `/workspaces/${workspaceId}/sessions/${deep}`,
          );
          if (
            generation === sessionsGeneration &&
            workspace.value?.id === workspaceId &&
            !sessions.value.some(({ id }) => id === session.id)
          )
            sessions.value = [session, ...sessions.value];
        } catch {
          // 深链无效则保持列表原样
        }
      }
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
    // 保留旧内容直到新内容到达：run 完成后并入时不闪烁
    if (transcript.value.length === 0) loadingTranscript.value = true;
    transcriptError.value = "";
    const generation = transcriptGeneration;
    try {
      const result = await api<{ transcript: TranscriptEntry[] }>(
        `/workspaces/${workspaceId}/sessions/${sessionId}/transcript`,
      );
      if (
        workspace.value?.id === workspaceId &&
        currentSession.value?.id === sessionId &&
        generation === transcriptGeneration
      )
        transcript.value = result.transcript;
    } catch (error) {
      if (
        workspace.value?.id === workspaceId &&
        currentSession.value?.id === sessionId &&
        generation === transcriptGeneration
      )
        transcriptError.value = errorMessage(error);
    } finally {
      if (
        workspace.value?.id === workspaceId &&
        currentSession.value?.id === sessionId &&
        generation === transcriptGeneration
      )
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
  async function renameSession(session: SessionDto, name: string) {
    const workspaceId = workspace.value?.id;
    if (!workspaceId || !name.trim()) return;
    sessionError.value = "";
    try {
      const { session: updated } = await api<{ session: SessionDto }>(
        `/workspaces/${workspaceId}/sessions/${session.id}`,
        { method: "PATCH", body: JSON.stringify({ name, confirm: true }) },
      );
      if (workspace.value?.id !== workspaceId) return;
      Object.assign(session, updated);
    } catch (error) {
      sessionError.value = errorMessage(error);
    }
  }
  async function deleteSession(session: SessionDto) {
    const workspaceId = workspace.value?.id;
    if (!workspaceId) return;
    sessionError.value = "";
    try {
      await api(`/workspaces/${workspaceId}/sessions/${session.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true }),
      });
      if (workspace.value?.id !== workspaceId) return;
      sessions.value = sessions.value.filter(({ id }) => id !== session.id);
      if (currentSession.value?.id === session.id) await router.push("/");
    } catch (error) {
      sessionError.value = errorMessage(error);
    }
  }
  watch(
    () => workspace.value?.id,
    async (_id, previous) => {
      sessionsGeneration++;
      transcriptGeneration++;
      sessions.value = [];
      nextCursor.value = undefined;
      transcript.value = [];
      // 仅真实切换 Workspace 时清掉 session 选择；首次加载保留 URL（刷新恢复）
      if (previous !== undefined && route.params.sessionId) await router.push("/");
    },
    { flush: "sync" },
  );
  watch(
    () => [workspace.value?.id, currentSession.value?.id],
    () => {
      // 立即清空避免新 session 视图短暂显示旧内容
      transcriptGeneration++;
      transcript.value = [];
      void loadTranscript();
    },
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
