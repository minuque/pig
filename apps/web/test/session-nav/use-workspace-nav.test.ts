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

import {
  SIDEBAR_GROUPING_KEY,
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

function admin() {
  return {
    sessionId: ref(undefined),
    router: { replace: vi.fn() } as never,
    refreshSessions: vi.fn(async () => undefined),
  }
}

function sessionsWithCwd(count: number, cwd = "/a"): SessionMetadata[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `s${String(index).padStart(2, "0")}`,
    createdAt: index,
    cwd,
  }))
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

  it("grouping 默认 updated，setGrouping 写入 localStorage 并清零 reveal", () => {
    const sessions = ref(sessionsWithCwd(12))
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())

    expect(nav.grouping.value).toBe("updated")
    expect(nav.rowsFor(false).value.filter((row) => row.kind === "session")).toHaveLength(10)

    nav.bumpGroup("updated")
    expect(nav.rowsFor(false).value.filter((row) => row.kind === "session")).toHaveLength(12)

    nav.setGrouping("project")
    expect(nav.grouping.value).toBe("project")
    expect(store.get(SIDEBAR_GROUPING_KEY)).toBe("project")
    expect(nav.revealByGroup.value).toEqual({})

    nav.setGrouping("updated")
    expect(nav.rowsFor(false).value.filter((row) => row.kind === "session")).toHaveLength(10)
  })

  it("启动时读取已持久化的 grouping", () => {
    store.set(SIDEBAR_GROUPING_KEY, "project")
    const nav = useWorkspaceNav(ref(sessionsWithCwd(1)), localWorkspaces(["/a"]), ref(""), admin())
    expect(nav.grouping.value).toBe("project")
  })

  it("更新时间分组截断后 bumpGroup 再露出一页；搜索不截断", () => {
    const sessions = ref(sessionsWithCwd(25))
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a"]), ref(""), admin())

    const truncated = nav.rowsFor(false).value
    expect(truncated.filter((row) => row.kind === "session")).toHaveLength(10)
    expect(truncated.at(-1)).toEqual({ kind: "more", key: "more:updated", groupKey: "updated" })

    nav.bumpGroup("updated")
    expect(nav.rowsFor(false).value.filter((row) => row.kind === "session")).toHaveLength(20)
    expect(nav.rowsFor(false).value.some((row) => row.kind === "more")).toBe(true)

    const searching = nav.rowsFor(true).value
    expect(searching.filter((row) => row.kind === "session")).toHaveLength(25)
    expect(searching.some((row) => row.kind === "more")).toBe(false)
  })

  it("项目分组每组截断，bumpGroup 只加该组", () => {
    const sessions = ref<SessionMetadata[]>([
      ...sessionsWithCwd(7, "/a"),
      ...Array.from({ length: 6 }, (_, index) => ({
        id: `b${index}`,
        createdAt: index,
        cwd: "/b",
      })),
    ])
    const nav = useWorkspaceNav(sessions, localWorkspaces(["/a", "/b"]), ref(""), admin())
    nav.setGrouping("project")

    const kinds = (searching: boolean) =>
      nav.rowsFor(searching).value.flatMap((row) => {
        if (row.kind === "session") return [`session:${row.session.id}`]
        if (row.kind === "more") return [`more:${row.groupKey}`]
        return [
          `group:${row.canonicalPath}`,
          ...row.sessions.map((session) => `session:${session.id}`),
          ...(row.more ? [`more:${row.canonicalPath}`] : []),
        ]
      })

    expect(kinds(false)).toEqual([
      "group:/a",
      "session:s06",
      "session:s05",
      "session:s04",
      "session:s03",
      "session:s02",
      "more:/a",
      "group:/b",
      "session:b5",
      "session:b4",
      "session:b3",
      "session:b2",
      "session:b1",
      "more:/b",
    ])

    nav.bumpGroup("/a")
    expect(kinds(false).filter((item) => item.startsWith("session:s"))).toHaveLength(7)
    expect(kinds(false)).toContain("more:/b")
    expect(kinds(false)).not.toContain("more:/a")
  })
})
