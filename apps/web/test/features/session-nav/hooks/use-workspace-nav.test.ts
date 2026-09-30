import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readonly, ref } from "vue"
import type { SessionMetadata } from "@/types/common-type.js"

const { platformRequestMock } = vi.hoisted(() => ({
  platformRequestMock: vi.fn(),
}))

vi.mock("@client/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/http.js")>()
  return { ...actual, platformRequest: platformRequestMock }
})

import { useSessionMarkers } from "@features/session-nav/hooks/use-session-markers.js"
import {
  SIDEBAR_SORT_KEY,
  SIDEBAR_VIEW_KEY,
  useWorkspaceNav,
} from "@features/session-nav/hooks/use-workspace-nav.js"

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

function admin(sessionId?: string, running = false) {
  return {
    sessionId: ref<string | undefined>(sessionId),
    running: ref<boolean>(running),
    router: { replace: vi.fn() } as never,
    refreshSessions: vi.fn(async () => undefined),
  }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe("useWorkspaceNav", () => {
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

  it("默认按工作区分组、手动排序，切换后写入并在下次启动读回", () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(nav.view.value).toBe("grouped")
    expect(nav.sort.value).toBe("manual")
    expect(nav.grouping.value).toBe("project")

    nav.setView("flat")
    nav.setSort("recent")
    expect(nav.grouping.value).toBe("updated")
    expect(store.get(SIDEBAR_VIEW_KEY)).toBe("flat")
    expect(store.get(SIDEBAR_SORT_KEY)).toBe("recent")

    const restored = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())
    expect(restored.view.value).toBe("flat")
    expect(restored.sort.value).toBe("recent")
  })

  it("点确认后立即从侧栏消失，服务端删完仍不回来", async () => {
    store.set("pig.sidebarPinnedSessions", JSON.stringify(["s2"]))

    const sessions = ref<SessionMetadata[]>([
      { id: "s1", createdAt: 1, cwd: "/a" },
      { id: "s2", createdAt: 2, cwd: "/a" },
    ])
    const deleteGate = deferred()
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/delete-session") await deleteGate.promise
      return { cards: [] }
    })
    const adm = admin()
    // 服务端删完后刷新会拿不到这条会话
    adm.refreshSessions = vi.fn(async () => {
      sessions.value = sessions.value.filter((session) => session.id !== "s2")
    })
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), adm)
    const markers = useSessionMarkers(nav.listedSessions, adm.sessionId)
    const pending = nav.deleteSession("s2")

    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
    expect(nav.groups.value.flatMap((group) => group.sessions.map((s) => s.id))).toEqual(["s1"])
    expect(markers.pinnedSessions.value).toEqual([])

    deleteGate.resolve()
    await pending

    expect(adm.refreshSessions).toHaveBeenCalledTimes(1)
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
    expect(markers.pinnedSessions.value).toEqual([])
  })

  it("删除失败时这一行回到原位并报错", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/delete-session") throw new Error("磁盘写入失败")
      return { cards: [] }
    })
    const navError = ref("")
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), navError, admin())

    await nav.deleteSession("s1")

    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
    expect(navError.value).not.toBe("")
  })

  it("删除当前会话时先回首页再发删除请求", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    const calls: string[] = []
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/delete-session") {
        calls.push("delete")
        throw new Error("删除失败")
      }

      return { cards: [] }
    })
    const adm = admin("s1")
    adm.router = {
      replace: vi.fn(() => {
        calls.push("replace")
      }),
    } as never
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), adm)

    await nav.deleteSession("s1")

    expect(calls).toEqual(["replace", "delete"])
  })

  it("运行中的当前会话拒绝删除", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    const navError = ref("")
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), navError, admin("s1", true))

    await nav.deleteSession("s1")

    expect(platformRequestMock).not.toHaveBeenCalled()
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
    expect(navError.value).not.toBe("")
  })
})
