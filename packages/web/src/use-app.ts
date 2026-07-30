import { onMounted, ref } from "vue";
import { bootstrapFromFragment, errorMessage } from "./api/index.js";
import { terminalStatuses, transcriptText } from "./features/runs/run-state.js";
import { useRuns } from "./features/runs/use-runs.js";
import { useSessions } from "./features/sessions/use-sessions.js";
import { useWorkspaceAccess } from "./features/workspaces/use-workspace-access.js";

export function useApp() {
  const startupError = ref("");
  const workspaceAccess = useWorkspaceAccess();
  const sessions = useSessions(workspaceAccess.workspace);
  const runs = useRuns(workspaceAccess.workspace, sessions.currentSession, sessions.loadTranscript);

  async function confirmWorkspace() {
    await workspaceAccess.confirmWorkspace();
    if (workspaceAccess.workspace.value) await sessions.loadSessions();
  }
  onMounted(async () => {
    try {
      await bootstrapFromFragment();
      await workspaceAccess.loadWorkspace();
      if (workspaceAccess.workspace.value) await sessions.loadSessions();
      await runs.startEvents();
    } catch (error) {
      startupError.value = errorMessage(error);
    }
  });
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
