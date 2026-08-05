import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";

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

import type { SessionDto, WorkspaceDto } from "../src/api/index.js";
import { useSessions } from "../src/features/sessions/use-sessions.js";

function workspace(id: string): WorkspaceDto {
  return { id, name: id, canonicalPath: `/${id}` };
}
function session(id: string, workspaceId: string): SessionDto {
  return { id, workspaceId, status: "available", updatedAt: "now" };
}

beforeEach(() => {
  api.mockReset();
  api.mockImplementation(() => new Promise(() => undefined));
  router.push.mockClear();
  router.replace.mockClear();
  mock.setParams!({});
});

describe("useSessions workspace isolation", () => {
  it("resolves currentSession only inside the route's workspace", async () => {
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    sessions.sessionsByWorkspace.value.set("a", [session("same", "a")]);
    sessions.sessionsByWorkspace.value.set("b", [session("same", "b")]);

    mock.setParams!({ workspaceId: "b", sessionId: "same" });
    await nextTick();
    expect(sessions.currentSession.value?.workspaceId).toBe("b");

    mock.setParams!({ workspaceId: "a", sessionId: "same" });
    await nextTick();
    expect(sessions.currentSession.value?.workspaceId).toBe("a");
  });

  it("does not commit a delayed transcript response to the same session id in another workspace", async () => {
    let resolve!: (value: { transcript: Array<{ content: string }> }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    sessions.sessionsByWorkspace.value.set("a", [session("same", "a")]);
    sessions.sessionsByWorkspace.value.set("b", [session("same", "b")]);

    mock.setParams!({ workspaceId: "a", sessionId: "same" });
    await nextTick(); // watch 触发 a 的 transcript 请求（挂起）
    mock.setParams!({ workspaceId: "b", sessionId: "same" });
    await nextTick(); // watch 触发 b 的请求并递增代次
    resolve({ transcript: [{ content: "wrong workspace" }] });
    await nextTick();

    expect(sessions.transcript.value).toEqual([]);
  });
});

describe("useSessions per-workspace caches", () => {
  it("keeps per-workspace session lists separate and does not overwrite each other", async () => {
    api.mockImplementation((path: string) => {
      if (path.startsWith("/workspaces/a/sessions"))
        return Promise.resolve({ sessions: [session("a1", "a")] });
      if (path.startsWith("/workspaces/b/sessions"))
        return Promise.resolve({ sessions: [session("b1", "b")] });
      return Promise.resolve({});
    });
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);

    await sessions.loadSessions("a");
    await sessions.loadSessions("b");

    expect(sessions.sessionsByWorkspace.value.get("a")?.map(({ id }) => id)).toEqual(["a1"]);
    expect(sessions.sessionsByWorkspace.value.get("b")?.map(({ id }) => id)).toEqual(["b1"]);
    // 兼容输出跟随活动 Workspace
    expect(sessions.sessions.value.map(({ id }) => id)).toEqual(["a1"]);
  });

  it("fetches a deep-linked session not on the first page separately", async () => {
    api.mockImplementation((path: string) => {
      if (path === "/workspaces/a/sessions?limit=25")
        return Promise.resolve({ sessions: [session("s1", "a")] });
      if (path === "/workspaces/a/sessions/deep")
        return Promise.resolve({ session: session("deep", "a") });
      return Promise.resolve({});
    });
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    mock.setParams!({ workspaceId: "a", sessionId: "deep" });
    await nextTick();

    await sessions.loadSessions("a");

    expect(sessions.sessionsByWorkspace.value.get("a")?.map(({ id }) => id)).toEqual([
      "deep",
      "s1",
    ]);
    expect(sessions.currentSession.value?.id).toBe("deep");
  });

  it("lazy-loads a workspace's sessions on first expand only", async () => {
    api.mockImplementation(() => Promise.resolve({ sessions: [session("a1", "a")] }));
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);

    sessions.toggleWorkspace("a");
    await nextTick();
    sessions.toggleWorkspace("a");
    sessions.toggleWorkspace("a");
    await nextTick();

    // 展开 → 收起 → 再展开只加载一次（缓存命中）
    expect(api).toHaveBeenCalledTimes(1);
    expect(sessions.expandedWorkspaceIds.value.has("a")).toBe(true);
  });
});

describe("useSessions session operations", () => {
  it("pushes the canonical workspace-qualified URL when creating a session", async () => {
    api.mockImplementation(() => Promise.resolve({ session: session("s1", "a") }));
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);

    const created = await sessions.createSession(workspace("a"));
    await sessions.createSession("b");

    expect(created?.id).toBe("s1");
    expect(router.push).toHaveBeenCalledWith("/workspaces/a/sessions/s1");
    expect(router.push).toHaveBeenCalledWith("/workspaces/b/sessions/s1");
    expect(sessions.sessionsByWorkspace.value.get("a")?.map(({ id }) => id)).toEqual(["s1"]);
    expect(sessions.sessionsByWorkspace.value.get("b")?.map(({ id }) => id)).toEqual(["s1"]);
  });

  it("renames a session via its own workspace, not the active one", async () => {
    api.mockImplementation(() =>
      Promise.resolve({ session: { ...session("s2", "b"), name: "新名字" } }),
    );
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    const target = session("s2", "b");
    sessions.sessionsByWorkspace.value.set("b", [target]);

    await sessions.renameSession(target, "新名字");

    expect(target.name).toBe("新名字");
    expect(api).toHaveBeenCalledWith(
      "/workspaces/b/sessions/s2",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("routes back to / when deleting the current session", async () => {
    api.mockImplementation(() => Promise.resolve({}));
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    const current = session("s1", "a");
    sessions.sessionsByWorkspace.value.set("a", [current]);
    mock.setParams!({ workspaceId: "a", sessionId: "s1" });
    await nextTick();

    await sessions.deleteSession(current);

    expect(router.push).toHaveBeenCalledWith("/");
    expect(sessions.sessionsByWorkspace.value.get("a")).toEqual([]);
  });

  it("deletes from the session's own workspace list without leaving the current session", async () => {
    api.mockImplementation(() => Promise.resolve({}));
    const active = ref<WorkspaceDto>(workspace("a"));
    const sessions = useSessions(active);
    const target = session("s2", "b");
    sessions.sessionsByWorkspace.value.set("b", [target]);
    mock.setParams!({ workspaceId: "a", sessionId: "s1" });
    await nextTick();

    await sessions.deleteSession(target);

    expect(api).toHaveBeenCalledWith(
      "/workspaces/b/sessions/s2",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(sessions.sessionsByWorkspace.value.get("b")).toEqual([]);
    expect(router.push).not.toHaveBeenCalled();
  });
});
