import { describe, expect, it } from "vitest"
import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import {
  conversationItemCount,
  filterSessionsForSearch,
  groupSessionsByCwd,
  sessionCardFoot,
  sessionOutcome,
  sidebarSections,
} from "@features/session-nav/lib/session-list.js"

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
      ["/a", "/b", "g:/AICode/pig", "G:\\aicode\\pig", "/empty"],
    )

    expect(groups.map((group) => group.canonicalPath)).toEqual([
      "/a",
      "/b",
      "g:/aicode/pig",
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

describe("sidebarSections", () => {
  const DAY = 24 * 60 * 60 * 1000
  const now = new Date(2026, 5, 10, 12, 0, 0).getTime()
  const base = {
    grouping: "date" as const,
    sort: "updated" as const,
    localWorkspaces: [],
    expandedByGroup: {},
    searching: false,
    now,
  }

  it("按日期分桶，桶内按排序键倒序", () => {
    const sections = sidebarSections({
      ...base,
      sessions: [
        { id: "old", createdAt: 1, updatedAt: now - 40 * DAY, cwd: "/a" },
        { id: "today1", createdAt: 1, updatedAt: now - 1000, cwd: "/a" },
        { id: "today2", createdAt: 2, updatedAt: now - 500, cwd: "/b" },
        { id: "week", createdAt: 3, updatedAt: now - 3 * DAY, cwd: "/a" },
      ],
    })

    expect(sections.map((section) => section.key)).toEqual(["date:0", "date:2", "date:3"])
    expect(sections[0]?.sessions.map((session) => session.id)).toEqual(["today2", "today1"])
  })

  it("置顶分区按存储顺序在前，不进日期桶", () => {
    const sections = sidebarSections({
      ...base,
      pinnedOrder: ["a1", "b1"],
      sessions: [
        { id: "a1", createdAt: 1, updatedAt: now - 1000, cwd: "/a" },
        { id: "b1", createdAt: 2, updatedAt: now - 2000, cwd: "/b" },
        { id: "c1", createdAt: 3, updatedAt: now - 500, cwd: "/a" },
      ],
    })

    expect(sections[0]?.key).toBe("pinned")
    expect(sections[0]?.sessions.map((session) => session.id)).toEqual(["a1", "b1"])
    expect(sections[1]?.sessions.map((session) => session.id)).toEqual(["c1"])
  })

  it("cwd 分组跳过空目录，搜索时不截断", () => {
    const sessions = Array.from({ length: 12 }, (_, index) => ({
      id: `s${index}`,
      createdAt: index,
      updatedAt: index,
      cwd: "/a",
    }))
    const paged = sidebarSections({
      ...base,
      grouping: "cwd",
      localWorkspaces: ["/a", "/empty"],
      sessions,
    })

    expect(paged.map((section) => section.key)).toEqual(["cwd:/a"])
    expect(paged[0]?.sessions).toHaveLength(10)
    expect(paged[0]?.more).toBe(true)

    const searching = sidebarSections({
      ...base,
      grouping: "cwd",
      localWorkspaces: ["/a", "/empty"],
      sessions,
      searching: true,
    })

    expect(searching[0]?.sessions).toHaveLength(12)
    expect(searching[0]?.more).toBe(false)
  })

  it("按创建时间排序", () => {
    const sections = sidebarSections({
      ...base,
      sort: "created",
      sessions: [
        { id: "newer-created", createdAt: now - 100, updatedAt: now - 1000, cwd: "/a" },
        { id: "newer-updated", createdAt: now - 2000, updatedAt: now - 100, cwd: "/a" },
      ],
    })

    expect(sections[0]?.sessions.map((session) => session.id)).toEqual([
      "newer-created",
      "newer-updated",
    ])
  })
})

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
    expect(sessionOutcome([user, timeout])).toBe("error")

    const extras = new Map([
      ["s1", { messageCount: 2, model: { provider: "openai", id: "gpt-4" } }],
    ])

    expect(
      sessionCardFoot("s1", extras, {
        sessionId: "s1",
        messageCount: 5,
        model: { provider: "anthropic", id: "claude" },
      }),
    ).toEqual({
      messageCount: 5,
      outcome: undefined,
      model: { provider: "anthropic", id: "claude" },
    })
    expect(sessionCardFoot("s1", extras, undefined)).toEqual({
      messageCount: 2,
      outcome: undefined,
      model: { provider: "openai", id: "gpt-4" },
    })
  })
})
