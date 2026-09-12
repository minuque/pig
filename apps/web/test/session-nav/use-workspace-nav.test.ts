import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readonly, ref } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"

const { platformRequestMock, settingsNav } = vi.hoisted(() => ({
  platformRequestMock: vi.fn(),
  settingsNav: {
    lastCwd: { value: undefined as string | undefined },
    activeWorkspaceId: { value: undefined as string | undefined },
    listedSessions: { value: [] as { cwd?: string }[] },
  },
}))

vi.mock("@client/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/http.js")>()
  return { ...actual, platformRequest: platformRequestMock }
})

vi.mock("@features/session-nav/index.js", () => ({
  useNav: () => settingsNav,
}))

import {
  SIDEBAR_GROUPING_KEY,
  useWorkspaceNav,
} from "@features/session-nav/hooks/use-workspace-nav.js"
import { useSettingsCwd } from "@features/settings/hooks/use-settings-cwd.js"

const store = new Map<string, string>()

function localWorkspaces(paths: string[]) {
  const workspaces = ref(paths)
  const lastCwd = ref<string | undefined>(paths[0])
  return {
    workspaces: readonly(workspaces),
    lastCwd: readonly(lastCwd),
    add: () => undefined,
    remove: () => undefined,
    selectCwd: () => undefined,
  }
}

function admin() {
  return {
    sessionId: ref(undefined),
    router: { replace: vi.fn() } as never,
    refreshSessions: vi.fn(async () => undefined),
  }
}

describe("useWorkspaceNav grouping", () => {
  beforeEach(() => {
    store.clear()
    platformRequestMock.mockReset()
    platformRequestMock.mockResolvedValue({ cards: [] })
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("grouping 默认 project，setGrouping 写入 localStorage 并在下次启动读回", () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(nav.grouping.value).toBe("project")

    nav.setGrouping("updated")
    expect(nav.grouping.value).toBe("updated")
    expect(store.get(SIDEBAR_GROUPING_KEY)).toBe("updated")

    const restored = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(restored.grouping.value).toBe("updated")
  })
})

describe("useSettingsCwd", () => {
  it("有打开会话时用会话目录，空态才用 lastCwd 或列表第一条有 cwd 的", () => {
    settingsNav.lastCwd.value = "/pref"
    settingsNav.activeWorkspaceId.value = "/session"
    settingsNav.listedSessions.value = [{ cwd: "/listed" }]
    expect(useSettingsCwd().value).toBe("/session")

    settingsNav.activeWorkspaceId.value = undefined
    expect(useSettingsCwd().value).toBe("/pref")

    settingsNav.lastCwd.value = undefined
    settingsNav.listedSessions.value = [{}, { cwd: "/listed" }]
    expect(useSettingsCwd().value).toBe("/listed")
  })
})
