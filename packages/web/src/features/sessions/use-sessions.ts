import type { TranscriptEntry } from "@no-pi-no-gang/contracts";
import { computed, ref, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, errorMessage, type SessionDto, type WorkspaceDto } from "../../api/index.js";

export function useSessions(workspace: Ref<WorkspaceDto | undefined>) {
  const route = useRoute();
  const router = useRouter();
  const routeWorkspaceId = computed(() => route.params.workspaceId as string | undefined);
  const routeSessionId = computed(() => route.params.sessionId as string | undefined);

  // 按 Workspace 隔离的缓存：懒加载后保留至页面刷新，互不覆盖
  const sessionsByWorkspace = ref<Map<string, SessionDto[]>>(new Map());
  const loadingWorkspaceIds = ref<Set<string>>(new Set());
  const sessionErrors = ref<Map<string, string>>(new Map());
  const nextCursors = ref<Map<string, string | undefined>>(new Map());
  // 每次 loadSessions 递增目标 Workspace 代次，迟到的响应不再提交
  const generations: Record<string, number> = {};

  // 导航树展开态：仅浏览用（ADR-0004），不持久化、不改变 Active Workspace
  const expandedWorkspaceIds = ref<Set<string>>(new Set());
  const creatingWorkspaceId = ref<string>();

  // 兼容输出：跟随活动 Workspace（由 useWorkspaceAccess 维护）；测试与外部仍引用
  const sessions = computed(() => {
    const wid = workspace.value?.id;
    return wid ? (sessionsByWorkspace.value.get(wid) ?? []) : [];
  });
  // 严格按 URL 的 workspaceId + sessionId 查找，相同 sessionId 不跨 Workspace 命中
  const currentSession = computed(() => {
    const wid = routeWorkspaceId.value;
    const sid = routeSessionId.value;
    if (!wid || !sid) return undefined;
    return sessionsByWorkspace.value.get(wid)?.find(({ id }) => id === sid);
  });

  const transcript = ref<TranscriptEntry[]>([]);
  const loadingTranscript = ref(false);
  const transcriptError = ref("");
  let transcriptGeneration = 0;

  function expandWorkspace(id: string, requiredSessionId?: string) {
    if (!expandedWorkspaceIds.value.has(id))
      expandedWorkspaceIds.value = new Set([...expandedWorkspaceIds.value, id]);
    const cached = sessionsByWorkspace.value.get(id);
    if (!cached || (requiredSessionId && !cached.some(({ id }) => id === requiredSessionId)))
      void loadSessions(id);
  }
  function toggleWorkspace(id: string) {
    if (!expandedWorkspaceIds.value.has(id)) {
      expandWorkspace(id);
      return;
    }
    const next = new Set(expandedWorkspaceIds.value);
    next.delete(id);
    expandedWorkspaceIds.value = next;
  }

  async function loadSessions(targetWorkspaceId: string, append = false) {
    const generation = (generations[targetWorkspaceId] = (generations[targetWorkspaceId] ?? 0) + 1);
    loadingWorkspaceIds.value.add(targetWorkspaceId);
    sessionErrors.value.set(targetWorkspaceId, "");
    try {
      const cursor = append ? nextCursors.value.get(targetWorkspaceId) : undefined;
      const page = await api<{ sessions: SessionDto[]; nextCursor?: string }>(
        `/workspaces/${targetWorkspaceId}/sessions?limit=25${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      );
      if (generations[targetWorkspaceId] !== generation) return;
      sessionsByWorkspace.value.set(
        targetWorkspaceId,
        append
          ? [...(sessionsByWorkspace.value.get(targetWorkspaceId) ?? []), ...page.sessions]
          : page.sessions,
      );
      nextCursors.value.set(targetWorkspaceId, page.nextCursor);
      // 深链恢复：URL 指向的 Session 不在首屏时单独请求
      const deepId =
        routeWorkspaceId.value === targetWorkspaceId ? routeSessionId.value : undefined;
      if (
        deepId &&
        !sessionsByWorkspace.value.get(targetWorkspaceId)?.some(({ id }) => id === deepId)
      ) {
        try {
          const { session } = await api<{ session: SessionDto }>(
            `/workspaces/${targetWorkspaceId}/sessions/${deepId}`,
          );
          const list = sessionsByWorkspace.value.get(targetWorkspaceId) ?? [];
          if (
            generations[targetWorkspaceId] === generation &&
            routeWorkspaceId.value === targetWorkspaceId &&
            !list.some(({ id }) => id === session.id)
          )
            sessionsByWorkspace.value.set(targetWorkspaceId, [session, ...list]);
        } catch {
          await router.replace("/");
        }
      }
    } catch (error) {
      if (generations[targetWorkspaceId] === generation)
        sessionErrors.value.set(targetWorkspaceId, errorMessage(error));
    } finally {
      if (generations[targetWorkspaceId] === generation)
        loadingWorkspaceIds.value.delete(targetWorkspaceId);
    }
  }

  function isCurrent(workspaceIdOfSession: string, sessionIdOfSession: string) {
    const current = currentSession.value;
    return current?.workspaceId === workspaceIdOfSession && current.id === sessionIdOfSession;
  }
  async function loadTranscript() {
    const current = currentSession.value;
    if (!current) {
      transcript.value = [];
      return;
    }
    // 保留旧内容直到新内容到达：run 完成后并入时不闪烁
    if (transcript.value.length === 0) loadingTranscript.value = true;
    transcriptError.value = "";
    const generation = transcriptGeneration;
    try {
      const result = await api<{ transcript: TranscriptEntry[] }>(
        `/workspaces/${current.workspaceId}/sessions/${current.id}/transcript`,
      );
      if (isCurrent(current.workspaceId, current.id) && generation === transcriptGeneration)
        transcript.value = result.transcript ?? [];
    } catch (error) {
      if (isCurrent(current.workspaceId, current.id) && generation === transcriptGeneration)
        transcriptError.value = errorMessage(error);
    } finally {
      if (isCurrent(current.workspaceId, current.id) && generation === transcriptGeneration)
        loadingTranscript.value = false;
    }
  }
  async function createSession(target?: WorkspaceDto | string) {
    const wid = typeof target === "string" ? target : (target?.id ?? workspace.value?.id);
    if (!wid || creatingWorkspaceId.value) return;
    creatingWorkspaceId.value = wid;
    sessionErrors.value.set(wid, "");
    try {
      const { session } = await api<{ session: SessionDto }>(`/workspaces/${wid}/sessions`, {
        method: "POST",
        body: JSON.stringify({ commandId: crypto.randomUUID() }),
      });
      sessionsByWorkspace.value.set(wid, [
        session,
        ...(sessionsByWorkspace.value.get(wid) ?? []).filter(({ id }) => id !== session.id),
      ]);
      await router.push(`/workspaces/${wid}/sessions/${session.id}`);
      return session;
    } catch (error) {
      sessionErrors.value.set(wid, errorMessage(error));
    } finally {
      creatingWorkspaceId.value = undefined;
    }
  }
  async function renameSession(session: SessionDto, name: string) {
    if (!name.trim()) return;
    sessionErrors.value.set(session.workspaceId, "");
    try {
      const { session: updated } = await api<{ session: SessionDto }>(
        `/workspaces/${session.workspaceId}/sessions/${session.id}`,
        { method: "PATCH", body: JSON.stringify({ name, confirm: true }) },
      );
      Object.assign(session, updated);
    } catch (error) {
      sessionErrors.value.set(session.workspaceId, errorMessage(error));
    }
  }
  async function deleteSession(session: SessionDto) {
    sessionErrors.value.set(session.workspaceId, "");
    try {
      await api(`/workspaces/${session.workspaceId}/sessions/${session.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true }),
      });
      const wasCurrent = isCurrent(session.workspaceId, session.id);
      sessionsByWorkspace.value.set(
        session.workspaceId,
        (sessionsByWorkspace.value.get(session.workspaceId) ?? []).filter(
          ({ id }) => id !== session.id,
        ),
      );
      if (wasCurrent) await router.push("/");
    } catch (error) {
      sessionErrors.value.set(session.workspaceId, errorMessage(error));
    }
  }
  watch(
    () => [currentSession.value?.id, currentSession.value?.workspaceId],
    () => {
      // 立即清空避免新 session 视图短暂显示旧内容
      transcriptGeneration++;
      transcript.value = [];
      void loadTranscript();
    },
  );
  return {
    sessions,
    creatingWorkspaceId,
    currentSession,
    sessionsByWorkspace,
    loadingWorkspaceIds,
    sessionErrors,
    nextCursors,
    expandedWorkspaceIds,
    expandWorkspace,
    toggleWorkspace,
    transcript,
    loadingTranscript,
    transcriptError,
    loadSessions,
    loadTranscript,
    createSession,
    renameSession,
    deleteSession,
  };
}
