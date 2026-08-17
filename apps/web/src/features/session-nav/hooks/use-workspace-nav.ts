import { computed, ref, watch, type Ref } from "vue";
import type { Router } from "vue-router";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import { errorMessage, platformRequest } from "@client/http.js";
import type { useLocalWorkspaces } from "@client/local-cwd.js";
import {
  groupSessionsByCwd,
  initialExpandedWorkspace,
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
  const expandedWorkspaceIds = ref(new Set<string>());

  function expandCwd(path: string) {
    if (!expandedWorkspaceIds.value.has(path))
      expandedWorkspaceIds.value = new Set([...expandedWorkspaceIds.value, path]);
  }
  function toggleWorkspace(path: string) {
    if (!expandedWorkspaceIds.value.has(path)) return expandCwd(path);
    const next = new Set(expandedWorkspaceIds.value);
    next.delete(path);
    expandedWorkspaceIds.value = next;
  }
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
        expandCwd(result.path);
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
  watch(
    groups,
    (list) => {
      if (expandedWorkspaceIds.value.size || !list.length) return;
      const target = initialExpandedWorkspace(list, local.lastCwd.value);
      if (target) expandCwd(target);
    },
    { immediate: true },
  );

  return {
    addingWorkspace,
    workspaces,
    groups,
    expandedWorkspaceIds,
    toggleWorkspace,
    addWorkspace,
    revokeWorkspace,
    renameSession,
    deleteSession,
  };
}
