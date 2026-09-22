import { describe, expect, it } from "vitest"
import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import {
  conversationItemCount,
  filterSessionsForSearch,
  groupSessionsByCwd,
  orderSessionGroups,
  sessionCardFoot,
  sessionOutcome,
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

describe("orderSessionGroups", () => {
  const groups = [
    { canonicalPath: "/a", sessions: [{ id: "a", createdAt: 10, cwd: "/a" }] },
    { canonicalPath: "/b", sessions: [{ id: "b", createdAt: 30, cwd: "/b" }] },
    { canonicalPath: "/empty", sessions: [] },
  ]

  it("按最近活动把更新的目录排前，空目录靠后", () => {
    expect(orderSessionGroups(groups, "recent", []).map((group) => group.canonicalPath)).toEqual([
      "/b",
      "/a",
      "/empty",
    ])
  })

  it("手动顺序优先，未记录的目录保持原顺序跟在后面", () => {
    expect(
      orderSessionGroups(groups, "manual", ["/empty", "/a"]).map((group) => group.canonicalPath),
    ).toEqual(["/empty", "/a", "/b"])
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
