import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const { api, route, router } = vi.hoisted(() => ({
  api: vi.fn(),
  route: { params: { sessionId: "same" } },
  router: { push: vi.fn(async () => undefined) },
}));
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => router,
}));
vi.mock("../src/api/index.js", () => ({
  api,
  errorMessage: () => "error",
}));

import type { SessionDto, WorkspaceDto } from "../src/api/index.js";
import { useSessions } from "../src/features/sessions/use-sessions.js";

describe("useSessions transcript identity", () => {
  it("does not commit a delayed response to the same session ID in another workspace", async () => {
    let resolve!: (value: { transcript: Array<{ content: string }> }) => void;
    api.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    api.mockImplementation(() => new Promise(() => undefined));
    const workspace = ref<WorkspaceDto>({ id: "a", name: "A", canonicalPath: "/a" });
    const sessions = useSessions(workspace);
    sessions.sessions.value = [
      { id: "same", workspaceId: "a", status: "available", updatedAt: "now" },
    ];
    const pending = sessions.loadTranscript();

    workspace.value = { id: "b", name: "B", canonicalPath: "/b" };
    sessions.sessions.value = [
      { id: "same", workspaceId: "b", status: "available", updatedAt: "now" },
    ];
    resolve({ transcript: [{ content: "wrong workspace" }] });
    await pending;

    expect(sessions.transcript.value).toEqual([]);
  });
});

describe("useSessions session operations", () => {
  it("renames the target session, not only the current one", async () => {
    api.mockImplementation(() => Promise.resolve({ session: { id: "s2", name: "新名字" } }));
    const workspace = ref<WorkspaceDto>({ id: "a", name: "A", canonicalPath: "/a" });
    const sessions = useSessions(workspace);
    const target: SessionDto = {
      id: "s2",
      workspaceId: "a",
      status: "available",
      updatedAt: "now",
    };
    sessions.sessions.value = [
      { id: "s1", workspaceId: "a", status: "available", updatedAt: "now" },
      target,
    ];

    await sessions.renameSession(target, "新名字");

    expect(target.name).toBe("新名字");
    expect(api).toHaveBeenCalledWith(
      "/workspaces/a/sessions/s2",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("routes back to / when deleting the current session", async () => {
    api.mockImplementation(() => Promise.resolve({}));
    const workspace = ref<WorkspaceDto>({ id: "a", name: "A", canonicalPath: "/a" });
    const sessions = useSessions(workspace);
    const current = { id: "s1", workspaceId: "a", status: "available" as const, updatedAt: "now" };
    sessions.sessions.value = [current];
    route.params.sessionId = "s1";

    await sessions.deleteSession(current);

    expect(router.push).toHaveBeenCalledWith("/");
    expect(sessions.sessions.value).toEqual([]);
  });
});
