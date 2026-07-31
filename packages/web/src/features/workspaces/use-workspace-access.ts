import { nextTick, ref } from "vue";
import { api, errorMessage, type WorkspaceDto } from "../../api/index.js";

export function useWorkspaceAccess() {
  const workspace = ref<WorkspaceDto>();
  const showAuthorize = ref(false);
  const previewPath = ref("");
  const authorizing = ref(false);
  const authorizeError = ref("");
  const pickerButton = ref<HTMLButtonElement>();

  async function loadWorkspace() {
    workspace.value = (await api<{ workspaces: WorkspaceDto[] }>("/workspaces")).workspaces[0];
    if (!workspace.value) {
      showAuthorize.value = true;
      await nextTick();
      pickerButton.value?.focus();
    }
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
      showAuthorize.value = false;
    } catch (error) {
      authorizeError.value = errorMessage(error);
    } finally {
      authorizing.value = false;
    }
  }
  return {
    workspace,
    showAuthorize,
    previewPath,
    authorizing,
    authorizeError,
    pickerButton,
    loadWorkspace,
    clearPreview,
    closeAuthorize,
    previewWorkspace,
    confirmWorkspace,
  };
}
