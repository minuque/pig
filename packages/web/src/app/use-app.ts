import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { bootstrapFromFragment, errorMessage } from "../api/index.js";
import { terminalStatuses, transcriptText } from "../features/runs/run-state.js";
import { useRuns } from "../features/runs/use-runs.js";
import { useSessions } from "../features/sessions/use-sessions.js";
import { useWorkspaceAccess } from "../features/workspaces/use-workspace-access.js";

export function useApp() {
  const route = useRoute();
  const startupError = ref("");
  const workspaceAccess = useWorkspaceAccess();
  const sessions = useSessions(workspaceAccess.workspace);
  const runs = useRuns(workspaceAccess.workspace, sessions.currentSession, sessions.loadTranscript);

  // 兼容新旧 App 接线：loadSessions(workspaceId, append?) 与旧形态 loadSessions() / loadSessions(true)
  function loadSessions(workspaceIdOrAppend?: string | boolean, append = false) {
    let wid: string | undefined;
    if (typeof workspaceIdOrAppend === "string") wid = workspaceIdOrAppend;
    else {
      wid = workspaceAccess.workspace.value?.id;
      append = workspaceIdOrAppend === true;
    }
    if (wid) return sessions.loadSessions(wid, append);
  }

  async function confirmWorkspace() {
    await workspaceAccess.confirmWorkspace();
    if (workspaceAccess.workspace.value)
      await sessions.loadSessions(workspaceAccess.workspace.value.id);
  }
  onMounted(async () => {
    try {
      await bootstrapFromFragment();
      await workspaceAccess.loadWorkspace();
      if (workspaceAccess.workspace.value)
        await sessions.loadSessions(workspaceAccess.workspace.value.id);
      await runs.startEvents();
    } catch (error) {
      startupError.value = errorMessage(error);
    }
  });
  // URL 切换（back/forward/深链）指向已授权 Workspace 且其列表未缓存时懒加载；
  // Active Workspace 切换由 useWorkspaceAccess 的 route watch 完成
  watch(
    () => route.params.workspaceId as string | undefined,
    (id) => {
      if (!id) return;
      if (!workspaceAccess.workspaces.value.some((item) => item.id === id)) return;
      if (!sessions.sessionsByWorkspace.value.has(id)) void sessions.loadSessions(id);
    },
  );
  return {
    ...workspaceAccess,
    ...sessions,
    ...runs,
    loadSessions,
    startupError,
    terminalStatuses,
    transcriptText,
    confirmWorkspace,
  };
}
