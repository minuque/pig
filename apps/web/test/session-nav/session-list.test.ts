import { describe, expect, it } from "vitest"
import type { SessionMetadata, TranscriptItem } from "@earendil-works/pi-protocol"
import {
  conversationItemCount,
  filterSessionsForSearch,
  groupSessionsByCwd,
  sessionCardFoot,
  sidebarRows,
  sortSessionsForSidebar,
} from "@features/session-nav/lib/session-list.js"
import type { SidebarRow } from "@features/session-nav/type.js"

function flattenRowKinds(
  rows: readonly SidebarRow[],
  flag: "first" | "collapsed" = "first",
): string[] {
  return rows.flatMap((row) => {
    if (row.kind === "session") return [`session:${row.session.id}`]
    if (row.kind === "more") return [`more:${row.groupKey}`]
    const head = `group:${row.canonicalPath}:${flag === "first" ? row.first : row.collapsed}`
    if (row.collapsed) return [head]
    return [
      head,
      ...row.sessions.map((session) => `session:${session.id}`),
      ...(row.more ? [`more:${row.canonicalPath}`] : []),
    ]
  })
}

function meta(
  id: string,
  createdAt: number,
  extra: Partial<SessionMetadata> = {},
): SessionMetadata {
  return { id, createdAt, ...extra }
}

describe("groupSessionsByCwd", () => {
  it("本地目录在前，无 cwd 不进组，组内按最近活动，Windows 路径对齐", () => {
    const groups = groupSessionsByCwd(
      [
        { id: "s1", createdAt: 1, cwd: "/b" },
        { id: "s2", createdAt: 2, cwd: "/a" },
        { id: "s3", createdAt: 3 },
        { id: "old", createdAt: 1, cwd: "/a" },
        { id: "open", createdAt: 1, cwd: "G:\\AICode\\pig" },
      ],
      ["/a", "/b", "g:/AICode/pig", "/empty"],
    )
    expect(groups.map((group) => group.canonicalPath)).toEqual([
      "/a",
      "/b",
      "g:/AICode/pig",
      "/empty",
    ])
    expect(groups[0]?.sessions.map((session) => session.id)).toEqual(["s2", "old"])
    expect(groups[2]?.sessions.map((session) => session.id)).toEqual(["open"])
    expect(groups[3]?.sessions).toEqual([])
  })
})

describe("filterSessionsForSearch", () => {
  it("按标题或目录名过滤，空查询原样返回", () => {
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
})

describe("sidebar rows", () => {
  it("更新时间截到 10 条后出 more", () => {
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
    expect(rows.filter((row) => row.kind === "session")).toHaveLength(10)
    expect(rows.at(-1)).toEqual({ kind: "more", key: "more:updated", groupKey: "updated" })
  })

  it("项目分组每组截到 5，折叠藏会话，搜索取消截断与折叠", () => {
    const aSessions = Array.from({ length: 7 }, (_, index) =>
      meta(`a${index}`, index, { cwd: "/a" }),
    )
    const bSessions = [meta("b0", 1, { cwd: "/b" })]
    const groups = [
      { canonicalPath: "/a", sessions: sortSessionsForSidebar(aSessions) },
      { canonicalPath: "/b", sessions: sortSessionsForSidebar(bSessions) },
    ]
    const truncated = sidebarRows({
      grouping: "project",
      sessions: [...aSessions, ...bSessions],
      groups,
      revealByGroup: {},
      searching: false,
    })
    expect(flattenRowKinds(truncated)).toEqual([
      "group:/a:true",
      "session:a6",
      "session:a5",
      "session:a4",
      "session:a3",
      "session:a2",
      "more:/a",
      "group:/b:false",
      "session:b0",
    ])
    const collapsed = sidebarRows({
      grouping: "project",
      sessions: [...aSessions, ...bSessions],
      groups,
      revealByGroup: {},
      searching: false,
      collapsedByGroup: { "/a": true },
    })
    expect(flattenRowKinds(collapsed, "collapsed")).toEqual([
      "group:/a:true",
      "group:/b:false",
      "session:b0",
    ])
    const searching = sidebarRows({
      grouping: "project",
      sessions: aSessions,
      groups: [{ canonicalPath: "/a", sessions: sortSessionsForSidebar(aSessions) }],
      revealByGroup: {},
      searching: true,
      collapsedByGroup: { "/a": true },
    })
    expect(searching.filter((row) => row.kind === "session" || row.kind === "group")).toHaveLength(
      1,
    )
    expect(searching.some((row) => row.kind === "more")).toBe(false)
    const group = searching[0]
    expect(group?.kind === "group" && group.sessions).toHaveLength(7)
  })
})

function transcriptItem(
  partial: Partial<TranscriptItem> & { role: TranscriptItem["role"] },
): TranscriptItem {
  return {
    id: "e1",
    timestamp: 0,
    content: [],
    ...partial,
  } as TranscriptItem
}

describe("session card foot", () => {
  it("空失败助手句不计条数；打开中用 live 覆盖磁盘卡片", () => {
    const user = transcriptItem({ role: "user", content: [{ type: "text", text: "ping" }] })
    const timeout = transcriptItem({
      id: "a1",
      role: "assistant",
      status: "error",
      errorMessage: "Request timed out.",
      content: [],
    })
    expect(conversationItemCount([user, timeout, timeout])).toBe(1)

    const extras = new Map([
      ["s1", { messageCount: 2, model: { provider: "openai", id: "gpt-4" } }],
    ])
    expect(
      sessionCardFoot("s1", extras, {
        sessionId: "s1",
        messageCount: 5,
        model: { provider: "anthropic", id: "claude" },
      }),
    ).toEqual({ messageCount: 5, modelProvider: "anthropic" })
    expect(sessionCardFoot("s1", extras, undefined)).toEqual({
      messageCount: 2,
      modelProvider: "openai",
    })
  })
})
