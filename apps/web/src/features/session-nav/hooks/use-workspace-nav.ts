import { computed, ref, shallowRef, watch, type Ref } from "vue";
import type { Router } from "vue-router";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import { errorMessage, platformRequest } from "@client/http.js";
import type { useLocalWorkspaces } from "@client/local-cwd.js";
import {
  groupSessionsByCwd,
  listSessionsForSidebar,
  localWorkspacesFrom,
  workspaceName,
} from "@features/session-nav/types.js";

type LocalWorkspaces = ReturnType<typeof useLocalWorkspaces>;

export function useWorkspaceNav(
  sessions: Ref<readonly SessionMetadata[]>,
  local: LocalWorkspaces,
  error: Ref<string>,
  admin: {
    sessionId: Ref<string | undefined>;
    router: Router;
    refreshSessions(): Promise<void>;
  },
) {
  const addingWorkspace = ref(false);
  const workspaces = computed(() => localWorkspacesFrom(local.workspaces.value));
  const groups = computed(() => groupSessionsByCwd(sessions.value, local.workspaces.value));
  /** null = 全部工作目录。对齐 T3 `projectScopeKey`。 */
  const projectScope = shallowRef<string | null>(null);
  const listedSessions = computed(() => listSessionsForSidebar(sessions.value, projectScope.value));

  watch(groups, (list) => {
    const scoped = projectScope.value;
    if (scoped !== null && !list.some((group) => group.canonicalPath === scoped)) {
      projectScope.value = null;
    }
  });

  async function addWorkspace() {
    if (addingWorkspace.value) return;
    addingWorkspace.value = true;
    error.value = "";
    try {
      let result = await platformRequest<{ path: string | null; requiresManualInput?: boolean }>(
        "/api/v1/platform/select-directory",
        { method: "POST" },
      );
      if (result.requiresManualInput) {
        const path = window.prompt("输入本地目录路径");
        if (!path) return;
        result = await platformRequest("/api/v1/platform/select-directory", {
          method: "POST",
          body: JSON.stringify({ path }),
        });
      }
      if (result.path) {
        local.add(result.path);
        local.selectCwd(result.path);
      }
    } catch (cause) {
      error.value = errorMessage(cause);
    } finally {
      addingWorkspace.value = false;
    }
  }
  function revokeWorkspace(path: string) {
    if (confirm(`从列表中移除 ${workspaceName(path)}？`)) local.remove(path);
  }
  async function renameSession(id: string, name: string) {
    error.value = "";
    try {
      await platformRequest("/api/v1/platform/rename-session", {
        method: "POST",
        body: JSON.stringify({ id, name }),
      });
      await admin.refreshSessions();
    } catch (cause) {
      error.value = errorMessage(cause);
    }
  }
  async function deleteSession(id: string) {
    error.value = "";
    try {
      await platformRequest("/api/v1/platform/delete-session", {
        method: "POST",
        body: JSON.stringify({ id }),
      });
      if (admin.sessionId.value === id) await admin.router.replace("/");
      await admin.refreshSessions();
    } catch (cause) {
      error.value = errorMessage(cause);
    }
  }
  return {
    addingWorkspace,
    workspaces,
    groups,
    listedSessions,
    projectScope,
    addWorkspace,
    revokeWorkspace,
    renameSession,
    deleteSession,
  };
}
