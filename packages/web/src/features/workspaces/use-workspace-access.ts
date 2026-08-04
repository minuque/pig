import { ref } from "vue";
import { api, errorMessage, type WorkspaceDto } from "../../api/index.js";

export function useWorkspaceAccess() {
  const workspace = ref<WorkspaceDto>();
  const workspaces = ref<WorkspaceDto[]>([]);
  const showAuthorize = ref(false);
  const previewPath = ref("");
  const authorizing = ref(false);
  const authorizeError = ref("");

  async function loadWorkspace() {
    workspaces.value = (await api<{ workspaces: WorkspaceDto[] }>("/workspaces")).workspaces;
    workspace.value = workspaces.value[0];
    if (!workspace.value) showAuthorize.value = true;
  }
  function clearPreview() {
    previewPath.value = "";
    authorizeError.value = "";
  }
  function closeAuthorize() {
    if (!authorizing.value) showAuthorize.value = false;
  }
  async function previewWorkspace() {
    if (authorizing.value) return;
    authorizing.value = true;
    authorizeError.value = "";
    try {
      const { path } = await api<{ path: string | null }>("/workspaces/select-directory", {
        method: "POST",
      });
      if (!path) return;
      previewPath.value = (
        await api<{ canonicalPath: string }>("/workspaces/preview", {
          method: "POST",
          body: JSON.stringify({ path }),
        })
      ).canonicalPath;
    } catch (error) {
      authorizeError.value = errorMessage(error);
    } finally {
      authorizing.value = false;
    }
  }
  async function confirmWorkspace() {
    if (authorizing.value || !previewPath.value) return;
    authorizing.value = true;
    authorizeError.value = "";
    try {
      workspace.value = (
        await api<{ workspace: WorkspaceDto }>("/workspaces/confirm", {
          method: "POST",
          body: JSON.stringify({ path: previewPath.value, commandId: crypto.randomUUID() }),
        })
      ).workspace;
      workspaces.value = [
        workspace.value,
        ...workspaces.value.filter(({ id }) => id !== workspace.value?.id),
      ];
      showAuthorize.value = false;
    } catch (error) {
      authorizeError.value = errorMessage(error);
    } finally {
      authorizing.value = false;
    }
  }
  async function revokeWorkspace() {
    if (!workspace.value || !confirm(`取消授权 ${workspace.value.name}？`)) return;
    await api(`/workspaces/${workspace.value.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    });
    workspaces.value = workspaces.value.filter(({ id }) => id !== workspace.value?.id);
    workspace.value = workspaces.value[0];
  }
  function selectWorkspace(id: string) {
    workspace.value = workspaces.value.find((item) => item.id === id);
  }
  return {
    workspace,
    workspaces,
    showAuthorize,
    previewPath,
    authorizing,
    authorizeError,
    loadWorkspace,
    clearPreview,
    closeAuthorize,
    previewWorkspace,
    confirmWorkspace,
    revokeWorkspace,
    selectWorkspace,
  };
}
