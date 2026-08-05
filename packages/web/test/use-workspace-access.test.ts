import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const { api, router, mock } = vi.hoisted(() => ({
  api: vi.fn(),
  router: { push: vi.fn(async () => undefined), replace: vi.fn(async () => undefined) },
  mock: { setParams: null as null | ((params: Record<string, string>) => void) },
}));
vi.mock("vue-router", async () => {
  const { reactive } = await import("vue");
  const state = reactive({ params: {} as Record<string, string> });
  mock.setParams = (params: Record<string, string>) => {
    state.params = params;
  };
  return { useRoute: () => state, useRouter: () => router };
});
vi.mock("../src/api/index.js", () => ({
  api,
  errorMessage: () => "error",
}));

import { useWorkspaceAccess } from "../src/features/workspaces/use-workspace-access.js";

function w(id: string) {
  return { id, name: id, canonicalPath: `/${id}` };
}

afterEach(() => {
  api.mockClear();
  vi.unstubAllGlobals();
});

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function candidate(canonicalPath: string) {
  return {
    canonicalPath,
    name: canonicalPath.replaceAll("\\", "/").split("/").pop()!,
    lastModified: new Date().toISOString(),
  };
}

describe("useWorkspaceAccess route restoration", () => {
  it("activates the workspace named by the canonical URL when authorized", async () => {
    api.mockImplementation(() => Promise.resolve({ workspaces: [w("a"), w("b")] }));
    mock.setParams!({ workspaceId: "b", sessionId: "s1" });
    const access = useWorkspaceAccess();

    await access.loadWorkspace();

    expect(access.workspace.value?.id).toBe("b");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("falls back to / when the canonical URL names an unauthorized workspace", async () => {
    api.mockImplementation(() => Promise.resolve({ workspaces: [w("a")] }));
    mock.setParams!({ workspaceId: "ghost", sessionId: "s1" });
    const access = useWorkspaceAccess();

    await access.loadWorkspace();

    expect(router.replace).toHaveBeenCalledWith("/");
    expect(access.workspace.value?.id).toBe("a");
  });

  it("keeps the current session when revoking another workspace", async () => {
    api.mockImplementation((path: string) =>
      path === "/workspaces"
        ? Promise.resolve({ workspaces: [w("a"), w("b")] })
        : Promise.resolve({}),
    );
    vi.stubGlobal("confirm", () => true);
    mock.setParams!({ workspaceId: "a", sessionId: "s1" });
    const access = useWorkspaceAccess();
    await access.loadWorkspace();

    await access.revokeWorkspace(w("b"));

    expect(access.workspace.value?.id).toBe("a");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("switches the active workspace when the route selects a session of another workspace", async () => {
    api.mockImplementation(() => Promise.resolve({ workspaces: [w("a"), w("b")] }));
    const access = useWorkspaceAccess();
    await access.loadWorkspace();
    expect(access.workspace.value?.id).toBe("a");

    mock.setParams!({ workspaceId: "b", sessionId: "s2" });
    await nextTick();

    expect(access.workspace.value?.id).toBe("b");
  });
});

describe("useWorkspaceAccess candidates", () => {
  it("loads candidates only when the authorize dialog opens, without blocking loadWorkspace", async () => {
    const candidatesCalls: string[] = [];
    api.mockImplementation((path: string) => {
      if (path === "/workspaces/candidates") {
        candidatesCalls.push(path);
        return new Promise(() => {}); // 永不 resolve：验证候选请求不阻塞 loadWorkspace
      }
      return Promise.resolve({ workspaces: [] });
    });
    const access = useWorkspaceAccess();
    expect(access.showAuthorize.value).toBe(false);
    expect(candidatesCalls).toHaveLength(0);

    await access.loadWorkspace();
    await nextTick();

    // 无 Workspace → loadWorkspace 已返回且 showAuthorize 置 true，watch 触发候选请求
    expect(access.showAuthorize.value).toBe(true);
    expect(candidatesCalls).toHaveLength(1);
    expect(access.candidatesLoading.value).toBe(true);
  });

  it("fetches candidates only once across repeated dialog opens", async () => {
    const candidates = [candidate("C:\\proj\\alpha")];
    api.mockImplementation((path: string) =>
      path === "/workspaces/candidates"
        ? Promise.resolve({ candidates })
        : Promise.resolve({ workspaces: [] }),
    );
    const access = useWorkspaceAccess();
    await access.loadWorkspace();
    await flush();
    expect(access.workspaceCandidates.value).toHaveLength(1);
    expect(access.candidatesLoading.value).toBe(false);

    access.showAuthorize.value = false;
    await nextTick();
    access.showAuthorize.value = true;
    await flush();

    expect(api.mock.calls.filter(([path]) => path === "/workspaces/candidates")).toHaveLength(1);
    expect(access.workspaceCandidates.value).toHaveLength(1);
  });

  it("selecting a candidate previews it without confirming", async () => {
    const selected = candidate("C:\\proj\\alpha");
    api.mockImplementation((path: string, init?: RequestInit) => {
      if (path === "/workspaces/candidates") return Promise.resolve({ candidates: [selected] });
      if (path === "/workspaces/preview")
        return Promise.resolve({ canonicalPath: selected.canonicalPath });
      return Promise.resolve({ workspaces: [] });
    });
    const access = useWorkspaceAccess();
    await access.loadWorkspace();
    await flush();

    await access.selectCandidate(selected);

    expect(access.previewPath.value).toBe(selected.canonicalPath);
    expect(api.mock.calls.filter(([path]) => path === "/workspaces/preview")).toHaveLength(1);
    expect(api.mock.calls.filter(([path]) => path === "/workspaces/confirm")).toHaveLength(0);
  });

  it("retries candidate loading after a failure when reopened", async () => {
    let fail = true;
    const loaded = [candidate("C:\\proj\\alpha")];
    api.mockImplementation((path: string) => {
      if (path === "/workspaces/candidates")
        return fail ? Promise.reject(new Error("boom")) : Promise.resolve({ candidates: loaded });
      return Promise.resolve({ workspaces: [] });
    });
    const access = useWorkspaceAccess();
    await access.loadWorkspace();
    await flush();

    expect(access.candidatesError.value).toBe("error");
    expect(access.candidatesLoading.value).toBe(false);
    expect(access.workspaceCandidates.value).toHaveLength(0);

    fail = false;
    access.showAuthorize.value = false;
    await nextTick();
    access.showAuthorize.value = true;
    await flush();

    expect(access.candidatesError.value).toBe("");
    expect(access.workspaceCandidates.value).toHaveLength(1);
  });
});
