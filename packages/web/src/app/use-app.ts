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

  async function confirmWorkspace() {
    await workspaceAccess.confirmWorkspace();
    const id = workspaceAccess.workspace.value?.id;
    if (!id) return;
    await sessions.loadSessions(id);
    sessions.expandWorkspace(id);
  }
  onMounted(async () => {
    try {
      await bootstrapFromFragment();
      await workspaceAccess.loadWorkspace();
      if (workspaceAccess.workspace.value) {
        await sessions.loadSessions(workspaceAccess.workspace.value.id);
        sessions.expandWorkspace(workspaceAccess.workspace.value.id);
      }
      await runs.startEvents();
    } catch (error) {
      startupError.value = errorMessage(error);
    }
  });
  // URL 切换（back/forward/深链）指向已授权 Workspace 且其列表未缓存时懒加载；
  // Active Workspace 切换由 useWorkspaceAccess 的 route watch 完成
  watch(
    () => [route.params.workspaceId, route.params.sessionId] as const,
    ([id, sessionId]) => {
      if (typeof id !== "string") return;
      if (!workspaceAccess.workspaces.value.some((item) => item.id === id)) return;
      sessions.expandWorkspace(id, typeof sessionId === "string" ? sessionId : undefined);
    },
  );
  return {
    ...workspaceAccess,
    ...sessions,
    ...runs,
    startupError,
    terminalStatuses,
    transcriptText,
    confirmWorkspace,
  };
}
