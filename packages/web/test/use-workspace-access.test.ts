import { describe, expect, it, vi } from "vitest";
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
