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
import { useWorkspaceNav } from "@features/session-nav/hooks/use-workspace-nav.js"
import { PlatformRequestError } from "@client/http.js"
import { t } from "@i18n/index.js"

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

  it("重命名先改标题，回执后刷新列表", async () => {
    const sessions = ref<SessionMetadata[]>([
      { id: "s1", createdAt: 1, cwd: "/a", sessionName: "旧名字" },
    ])

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/rename-session") return {}
      return { cards: [] }
    })
    const adm = admin()
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), adm)
    const pending = nav.renameSession("s1", "新名字")

    expect(nav.listedSessions.value[0]?.sessionName).toBe("新名字")
    await pending

    expect(platformRequestMock).toHaveBeenCalledWith("/api/v1/platform/rename-session", {
      method: "POST",
      body: JSON.stringify({ id: "s1", name: "新名字" }),
    })
    expect(nav.listedSessions.value[0]?.sessionName).toBe("新名字")
    expect(adm.refreshSessions).toHaveBeenCalledTimes(1)
  })

  it("失败路径：重命名失败回滚标题且不刷新", async () => {
    const sessions = ref<SessionMetadata[]>([
      { id: "s1", createdAt: 1, cwd: "/a", sessionName: "旧名字" },
    ])

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/rename-session") {
        throw new PlatformRequestError("INTERNAL", "r1")
      }

      return { cards: [] }
    })
    const adm = admin()
    const navError = ref("")
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), navError, adm)

    await nav.renameSession("s1", "新名字")

    expect(nav.listedSessions.value[0]?.sessionName).toBe("旧名字")
    expect(navError.value).not.toBe("")
    expect(adm.refreshSessions).not.toHaveBeenCalled()
  })

  it("重命名不回滚占位：同一会话连续改名保留最后一次", async () => {
    const sessions = ref<SessionMetadata[]>([
      { id: "s1", createdAt: 1, cwd: "/a", sessionName: "旧名字" },
    ])

    platformRequestMock.mockImplementation(async () => ({ cards: [] }))
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())

    await nav.renameSession("s1", "甲")
    await nav.renameSession("s1", "乙")

    expect(nav.listedSessions.value[0]?.sessionName).toBe("乙")
  })

  it("删除遇 BUSY 时等一轮重试，第二次成功即真删", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    let attempts = 0
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/delete-session") {
        attempts += 1

        if (attempts === 1) throw new PlatformRequestError("BUSY", "r1")
      }

      return { cards: [] }
    })
    const adm = admin()
    const navError = ref("")
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), navError, adm)

    await nav.deleteSession("s1")

    expect(attempts).toBe(2)
    expect(navError.value).toBe("")
    expect(adm.refreshSessions).toHaveBeenCalledTimes(1)
    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
  })

  it("失败路径：BUSY 两次仍失败时回到原位并提示停轮", async () => {
    const sessions = ref<SessionMetadata[]>([{ id: "s1", createdAt: 1, cwd: "/a" }])
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/delete-session") {
        throw new PlatformRequestError("BUSY", "r1")
      }

      return { cards: [] }
    })
    const navError = ref("")
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), navError, admin())
    const pending = nav.deleteSession("s1")

    expect(nav.listedSessions.value.map((session) => session.id)).toEqual([])
    await pending

    expect(nav.listedSessions.value.map((session) => session.id)).toEqual(["s1"])
    expect(navError.value).toBe(t("session.stopRunningBeforeDelete"))
  })

  it("选到目录后写本地列表并设为 lastCwd", async () => {
    const local = localWorkspaces([])
    const add = vi.spyOn(local, "add")
    const selectCwd = vi.spyOn(local, "selectCwd")
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/select-directory") {
        return { path: "/x", requiresManualInput: false }
      }

      return { cards: [] }
    })
    const nav = useWorkspaceNav(ref<SessionMetadata[]>([]), local, ref(""), admin())

    await nav.addWorkspace()

    expect(platformRequestMock).toHaveBeenCalledWith("/api/v1/platform/select-directory", {
      method: "POST",
    })
    expect(add).toHaveBeenCalledWith("/x")
    expect(selectCwd).toHaveBeenCalledWith("/x")
    expect(nav.addingWorkspace.value).toBe(false)
  })

  it("失败路径：服务端要手输路径时用 prompt 再选一次", async () => {
    const local = localWorkspaces([])
    const add = vi.spyOn(local, "add")
    const responses = [
      { path: null, requiresManualInput: true },
      { path: "/manual", requiresManualInput: false },
    ]

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/select-directory") return responses.shift()
      return { cards: [] }
    })
    const prompt = vi.fn(() => "D:/work")
    vi.stubGlobal("window", { prompt })
    const nav = useWorkspaceNav(ref<SessionMetadata[]>([]), local, ref(""), admin())

    await nav.addWorkspace()

    expect(prompt).toHaveBeenCalledTimes(1)
    expect(platformRequestMock).toHaveBeenLastCalledWith("/api/v1/platform/select-directory", {
      method: "POST",
      body: JSON.stringify({ path: "D:/work" }),
    })
    expect(add).toHaveBeenCalledWith("/manual")
  })

  it("失败路径：手输路径被取消则不写入本地列表", async () => {
    const local = localWorkspaces([])
    const add = vi.spyOn(local, "add")
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path === "/api/v1/platform/select-directory") {
        return { path: null, requiresManualInput: true }
      }

      return { cards: [] }
    })
    vi.stubGlobal("window", { prompt: vi.fn(() => null) })
    const nav = useWorkspaceNav(ref<SessionMetadata[]>([]), local, ref(""), admin())

    await nav.addWorkspace()

    expect(add).not.toHaveBeenCalled()
    expect(nav.addingWorkspace.value).toBe(false)
  })
})
