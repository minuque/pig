import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { WorkspaceCandidate } from "@no-pi-no-gang/contracts";
import { api, errorMessage, type WorkspaceDto } from "../../api/index.js";

export function useWorkspaceAccess() {
  const route = useRoute();
  const router = useRouter();
  const workspace = ref<WorkspaceDto>();
  const workspaces = ref<WorkspaceDto[]>([]);
  const showAuthorize = ref(false);
  const previewPath = ref("");
  const authorizing = ref(false);
  const authorizeError = ref("");
  const workspaceCandidates = ref<WorkspaceCandidate[]>([]);
  const candidatesLoading = ref(false);
  const candidatesError = ref("");
  let loaded = false;
  // 已成功加载后保持 promise，重开不重拉；失败时清空允许下次重试
  let candidatesPromise: Promise<void> | undefined;

  function ensureCandidates(): void {
    if (candidatesPromise) return;
    candidatesLoading.value = true;
    candidatesError.value = "";
    candidatesPromise = api<{ candidates: WorkspaceCandidate[] }>("/workspaces/candidates")
      .then(({ candidates }) => {
        workspaceCandidates.value = candidates;
      })
      .catch((error) => {
        candidatesError.value = errorMessage(error);
        candidatesPromise = undefined;
      })
      .finally(() => {
        candidatesLoading.value = false;
      });
  }
  // 候选预览：pick 与候选点击共用；只预览，授权仍由用户点“确认并授权”
  async function previewPathOf(path: string): Promise<string> {
    const { canonicalPath } = await api<{ canonicalPath: string }>("/workspaces/preview", {
      method: "POST",
      body: JSON.stringify({ path }),
    });
    return canonicalPath;
  }

  async function loadWorkspace() {
    workspaces.value = (await api<{ workspaces: WorkspaceDto[] }>("/workspaces")).workspaces;
    loaded = true;
    // 规范 URL 的 workspaceId 已授权时恢复为 Active Workspace
    const urlWorkspaceId = route.params.workspaceId as string | undefined;
    workspace.value = workspaces.value.find((item) => item.id === urlWorkspaceId);
    if (!workspace.value) {
      // URL 指向未授权 Workspace → 回退欢迎页，不自动选择其他 Session
      if (urlWorkspaceId) await router.replace("/");
      workspace.value = workspaces.value[0];
      if (!workspaces.value.length) showAuthorize.value = true;
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
      previewPath.value = await previewPathOf(path);
    } catch (error) {
      authorizeError.value = errorMessage(error);
    } finally {
      authorizing.value = false;
    }
  }
  async function selectCandidate(candidate: WorkspaceCandidate) {
    if (authorizing.value) return;
    authorizing.value = true;
    authorizeError.value = "";
    try {
      previewPath.value = await previewPathOf(candidate.canonicalPath);
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
      // 已授权目录从候选列表移除（canonicalPath 由 gateway 规范化，可直接比较）
      workspaceCandidates.value = workspaceCandidates.value.filter(
        ({ canonicalPath }) => canonicalPath !== previewPath.value,
      );
      showAuthorize.value = false;
    } catch (error) {
      authorizeError.value = errorMessage(error);
    } finally {
      authorizing.value = false;
    }
  }
  async function revokeWorkspace(target?: WorkspaceDto) {
    const targetWorkspace = target ?? workspace.value;
    if (!targetWorkspace || !confirm(`取消授权 ${targetWorkspace.name}？`)) return;
    await api(`/workspaces/${targetWorkspace.id}`, {
      method: "DELETE",
      body: JSON.stringify({ confirm: true }),
    });
    workspaces.value = workspaces.value.filter(({ id }) => id !== targetWorkspace.id);
    if (workspace.value?.id !== targetWorkspace.id) return;
    workspace.value = workspaces.value[0];
    if (route.params.workspaceId === targetWorkspace.id) await router.push("/");
  }
  // 路由驱动：选择非活动 Workspace 的 Session 时切换 Active Workspace；未授权 URL 回退欢迎页
  watch(
    () => route.params.workspaceId,
    (id) => {
      if (!loaded || !id) return;
      const found = workspaces.value.find((item) => item.id === id);
      if (found) workspace.value = found;
      else void router.replace("/");
    },
  );
  // 打开授权 Dialog 时才冷加载最近目录，不阻塞 loadWorkspace/startup
  watch(showAuthorize, (show) => {
    if (show) void ensureCandidates();
  });
  return {
    workspace,
    workspaces,
    showAuthorize,
    previewPath,
    authorizing,
    authorizeError,
    workspaceCandidates,
    candidatesLoading,
    candidatesError,
    loadWorkspace,
    ensureCandidates,
    clearPreview,
    closeAuthorize,
    previewWorkspace,
    selectCandidate,
    confirmWorkspace,
    revokeWorkspace,
  };
}
