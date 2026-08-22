import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, readonly, ref } from "vue";
import type { SessionMetadata } from "@earendil-works/pi-protocol";

const { platformRequestMock } = vi.hoisted(() => ({
  platformRequestMock: vi.fn(),
}));

vi.mock("@client/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/http.js")>();
  return { ...actual, platformRequest: platformRequestMock };
});

import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js";

function localWorkspaces(paths: string[]) {
  const workspaces = ref(paths);
  const lastCwd = ref<string | undefined>(paths[0]);
  return {
    workspaces: readonly(workspaces),
    lastCwd: readonly(lastCwd),
    add: () => undefined,
    remove: () => undefined,
    selectCwd: () => undefined,
  };
}

describe("useWorkspaceNav projectScope", () => {
  beforeEach(() => {
    platformRequestMock.mockReset();
    platformRequestMock.mockResolvedValue({ cards: [] });
  });

  it("打开会话后 cwd 写法变化不重置工作目录筛选", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "g:/AICode/pig" }]);
    const nav = useWorkspaceNav(sessions, localWorkspaces(["g:/AICode/pig"]), ref(""), {
      sessionId: ref(undefined),
      connected: ref(false),
      router: { replace: vi.fn() } as never,
      refreshSessions: vi.fn(async () => undefined),
    });

    nav.projectScope.value = "g:/AICode/pig";
    await nextTick();
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"]);

    // attach 后 Pi 用 getCwd() 覆盖列表 cwd，写法从规范路径变成 Windows 原样。
    sessions.value = [{ id: "s1", createdAt: 1, cwd: "G:\\AICode\\pig" }];
    await nextTick();

    expect(nav.projectScope.value).toBe("g:/AICode/pig");
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"]);
  });

  it("无本地授权目录时，打开会话也不把筛选打回全部", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "g:/AICode/pig" }]);
    const nav = useWorkspaceNav(sessions, localWorkspaces([]), ref(""), {
      sessionId: ref(undefined),
      connected: ref(false),
      router: { replace: vi.fn() } as never,
      refreshSessions: vi.fn(async () => undefined),
    });

    nav.projectScope.value = "g:/AICode/pig";
    sessions.value = [{ id: "s1", createdAt: 1, cwd: "G:\\AICode\\pig" }];
    await nextTick();

    expect(nav.projectScope.value).toBe("g:/AICode/pig");
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"]);
  });
});
