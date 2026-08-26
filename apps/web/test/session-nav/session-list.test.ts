import { describe, expect, it } from "vitest"
import type { SessionMetadata } from "@earendil-works/pi-protocol"
import { sessionTitle, workspaceName } from "@features/session-nav/format.js"
import {
  PROJECT_PAGE,
  UPDATED_PAGE,
  bumpReveal,
  filterSessionsForSearch,
  shouldFollowActiveSession,
  groupSessionsByCwd,
  listSessionsForSidebar,
  modelDisplayNames,
  sessionCardFoot,
  sessionModelLabel,
  sidebarRows,
  sortSessionsForSidebar,
} from "@features/session-nav/sidebar.js"

function meta(
  id: string,
  createdAt: number,
  extra: Partial<SessionMetadata> = {},
): SessionMetadata {
  return { id, createdAt, ...extra }
}

describe("workspaceName and grouping", () => {
  it("uses the last path segment as display name", () => {
    expect(workspaceName("/repo/app/src")).toBe("src")
    expect(workspaceName("C:\\repo\\app")).toBe("app")
    expect(workspaceName("/")).toBe("/")
  })
  it("keeps session cwd groups when local workspaces are empty", () => {
    const groups = groupSessionsByCwd([{ id: "s1", createdAt: 1, cwd: "/pig" }], [])
    expect(groups.map((group) => group.canonicalPath)).toEqual(["/pig"])
  })
  it("groups sessions by cwd, following local workspace order", () => {
    const sessions: SessionMetadata[] = [
      { id: "s1", createdAt: 1, cwd: "/b" },
      { id: "s2", createdAt: 2, cwd: "/a" },
      { id: "s3", createdAt: 3 },
    ]
    const groups = groupSessionsByCwd(sessions, ["/a", "/b"])
    expect(groups).toEqual([
      {
        canonicalPath: "/a",
        sessions: [{ id: "s2", createdAt: 2, cwd: "/a" }],
      },
      {
        canonicalPath: "/b",
        sessions: [{ id: "s1", createdAt: 1, cwd: "/b" }],
      },
    ])
  })
  it("sorts sessions in a group by recency", () => {
    const groups = groupSessionsByCwd(
      [
        { id: "old", createdAt: 1, cwd: "/a" },
        { id: "new", createdAt: 2, updatedAt: 9, cwd: "/a" },
      ],
      ["/a"],
    )
    expect(groups[0]?.sessions.map((session) => session.id)).toEqual(["new", "old"])
  })

  it("titles unnamed sessions as 新会话", () => {
    expect(sessionTitle({})).toBe("新会话")
    expect(sessionTitle({ sessionName: "  卸载插件  " })).toBe("卸载插件")
  })

  it("merges live Windows cwd into the canonical local workspace group", () => {
    const groups = groupSessionsByCwd(
      [{ id: "open", createdAt: 1, cwd: "G:\\AICode\\pig" }],
      ["g:/AICode/pig"],
    )
    expect(groups).toEqual([
      {
        canonicalPath: "g:/AICode/pig",
        sessions: [{ id: "open", createdAt: 1, cwd: "G:\\AICode\\pig" }],
      },
    ])
  })

  it("keeps empty local workspaces and appends sessions from other cwd", () => {
    const groups = groupSessionsByCwd(
      [
        { id: "s1", createdAt: 1, cwd: "/a" },
        { id: "s2", createdAt: 2, cwd: "/other" },
      ],
      ["/a", "/empty"],
    )
    expect(groups).toEqual([
      {
        canonicalPath: "/a",
        sessions: [{ id: "s1", createdAt: 1, cwd: "/a" }],
      },
      { canonicalPath: "/empty", sessions: [] },
      {
        canonicalPath: "/other",
        sessions: [{ id: "s2", createdAt: 2, cwd: "/other" }],
      },
    ])
  })
})

describe("session-dimension list", () => {
  it("drops sessions without cwd and sorts by recency", () => {
    const sessions: SessionMetadata[] = [
      { id: "old", createdAt: 1, cwd: "/b", updatedAt: 90 },
      { id: "new", createdAt: 3, cwd: "/a" },
      { id: "mid", createdAt: 2, cwd: "/a", updatedAt: 80 },
      { id: "orphan", createdAt: 4 },
    ]
    expect(listSessionsForSidebar(sessions).map((session) => session.id)).toEqual([
      "old",
      "mid",
      "new",
    ])
  })

  it("filters listed sessions by title or workspace name", () => {
    const sessions: SessionMetadata[] = [
      { id: "a", createdAt: 1, cwd: "/repo/pig", sessionName: "渲染性能" },
      { id: "b", createdAt: 2, cwd: "/repo/tmp", sessionName: "Friendly Greeting" },
    ]
    expect(filterSessionsForSearch(sessions, "").map((session) => session.id)).toEqual(["a", "b"])
    expect(filterSessionsForSearch(sessions, "  greeting ").map((session) => session.id)).toEqual([
      "b",
    ])
    expect(filterSessionsForSearch(sessions, "PIG").map((session) => session.id)).toEqual(["a"])
  })

  it("sorts by recency descending then id", () => {
    expect(
      sortSessionsForSidebar([
        { id: "older", createdAt: 1, updatedAt: 100, cwd: "/a" },
        { id: "newer", createdAt: 2, cwd: "/a" },
      ]).map((session) => session.id),
    ).toEqual(["older", "newer"])
    expect(
      sortSessionsForSidebar([
        { id: "b", createdAt: 5, cwd: "/a" },
        { id: "a", createdAt: 5, cwd: "/a" },
      ]).map((session) => session.id),
    ).toEqual(["a", "b"])
  })
})

describe("sidebar rows", () => {
  it("truncates updated grouping to 10 then a more row", () => {
    expect(UPDATED_PAGE).toBe(10)
    const sessions = Array.from({ length: 12 }, (_, index) =>
      meta(`s${String(index).padStart(2, "0")}`, index, { cwd: "/a" }),
    )
    const rows = sidebarRows({
      grouping: "updated",
      sessions,
      groups: [],
      revealByGroup: {},
      searching: false,
    })
    expect(rows.some((row) => row.kind === "group")).toBe(false)
    expect(rows.filter((row) => row.kind === "session").map((row) => row.session.id)).toEqual([
      "s11",
      "s10",
      "s09",
      "s08",
      "s07",
      "s06",
      "s05",
      "s04",
      "s03",
      "s02",
    ])
    expect(rows.at(-1)).toEqual({ kind: "more", key: "more:updated", groupKey: "updated" })
  })

  it("hides updated more when all sessions are revealed", () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      meta(`s${index}`, index, { cwd: "/a" }),
    )
    const rows = sidebarRows({
      grouping: "updated",
      sessions,
      groups: [],
      revealByGroup: { updated: 20 },
      searching: false,
    })
    expect(rows.filter((row) => row.kind === "session")).toHaveLength(12)
    expect(rows.some((row) => row.kind === "more")).toBe(false)
  })

  it("truncates each project group to 5 and keeps empty group headers", () => {
    expect(PROJECT_PAGE).toBe(5)
    const aSessions = Array.from({ length: 7 }, (_, index) =>
      meta(`a${index}`, index, { cwd: "/a" }),
    )
    const bSessions = Array.from({ length: 6 }, (_, index) =>
      meta(`b${index}`, index, { cwd: "/b" }),
    )
    const rows = sidebarRows({
      grouping: "project",
      sessions: [...aSessions, ...bSessions],
      groups: [
        { canonicalPath: "/a", sessions: sortSessionsForSidebar(aSessions) },
        { canonicalPath: "/empty", sessions: [] },
        { canonicalPath: "/b", sessions: sortSessionsForSidebar(bSessions) },
      ],
      revealByGroup: {},
      searching: false,
    })
    expect(
      rows.map((row) => {
        if (row.kind === "group") return `group:${row.canonicalPath}:${row.first}`
        if (row.kind === "session") return `session:${row.session.id}`
        return `more:${row.groupKey}`
      }),
    ).toEqual([
      "group:/a:true",
      "session:a6",
      "session:a5",
      "session:a4",
      "session:a3",
      "session:a2",
      "more:/a",
      "group:/empty:false",
      "group:/b:false",
      "session:b5",
      "session:b4",
      "session:b3",
      "session:b2",
      "session:b1",
      "more:/b",
    ])
  })

  it("shows every session and no more while searching", () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      meta(`s${index}`, index, { cwd: "/a" }),
    )
    const updated = sidebarRows({
      grouping: "updated",
      sessions,
      groups: [],
      revealByGroup: {},
      searching: true,
    })
    expect(updated.filter((row) => row.kind === "session")).toHaveLength(12)
    expect(updated.some((row) => row.kind === "more")).toBe(false)

    const aSessions = Array.from({ length: 7 }, (_, index) =>
      meta(`a${index}`, index, { cwd: "/a" }),
    )
    const project = sidebarRows({
      grouping: "project",
      sessions: aSessions,
      groups: [
        { canonicalPath: "/a", sessions: sortSessionsForSidebar(aSessions) },
        { canonicalPath: "/empty", sessions: [] },
      ],
      revealByGroup: {},
      searching: true,
    })
    expect(project.map((row) => row.kind)).toEqual([
      "group",
      "session",
      "session",
      "session",
      "session",
      "session",
      "session",
      "session",
      "group",
    ])
  })

  it("treats a missing reveal count as one page when bumping", () => {
    expect(bumpReveal(undefined, 10)).toBe(20)
    expect(bumpReveal(10, 10)).toBe(20)
    expect(bumpReveal(undefined, 5)).toBe(10)
  })

  it("does not follow the active session again when rows expand", () => {
    expect(shouldFollowActiveSession("s1", "s1")).toBe(false)
    expect(shouldFollowActiveSession("s2", "s1")).toBe(true)
    expect(shouldFollowActiveSession("s1", undefined)).toBe(true)
    expect(shouldFollowActiveSession(undefined, "s1")).toBe(false)
  })
})

describe("session card foot", () => {
  it("uses catalog name and live overlay for the open session", () => {
    const extras = new Map([
      ["s1", { messageCount: 2, model: { provider: "openai", id: "gpt-4" } }],
      ["s2", { messageCount: 9, model: { provider: "openai", id: "o3" } }],
    ])
    const names = modelDisplayNames([
      {
        id: "openai",
        models: [
          { id: "gpt-4", name: "GPT-4" },
          { id: "o3", name: "o3" },
        ],
      },
    ])
    expect(sessionCardFoot("s1", extras, undefined, names)).toEqual({
      messageCount: 2,
      modelLabel: "GPT-4",
      modelProvider: "openai",
    })
    expect(
      sessionCardFoot(
        "s1",
        extras,
        { sessionId: "s1", messageCount: 5, model: { provider: "openai", id: "o3" } },
        names,
      ),
    ).toEqual({ messageCount: 5, modelLabel: "o3", modelProvider: "openai" })
    expect(sessionModelLabel({ provider: "x", id: "unknown" }, names)).toBe("unknown")
  })

  it("live 用窗口总条数，缺省则回落 extras", () => {
    const extras = new Map([
      ["s1", { messageCount: 193, model: { provider: "openai", id: "gpt-4" } }],
    ])
    const names = modelDisplayNames([{ id: "openai", models: [{ id: "gpt-4", name: "GPT-4" }] }])
    expect(
      sessionCardFoot(
        "s1",
        extras,
        { sessionId: "s1", messageCount: 200, model: { provider: "openai", id: "gpt-4" } },
        names,
      ),
    ).toEqual({ messageCount: 200, modelLabel: "GPT-4", modelProvider: "openai" })
    expect(
      sessionCardFoot(
        "s1",
        extras,
        { sessionId: "s1", model: { provider: "openai", id: "gpt-4" } },
        names,
      ),
    ).toEqual({ messageCount: 193, modelLabel: "GPT-4", modelProvider: "openai" })
  })
})
