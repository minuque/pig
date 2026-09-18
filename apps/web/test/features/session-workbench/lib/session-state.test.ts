import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem, UserTranscriptItem } from "@/types/common-type.js"
import {
  absorbLatestTranscriptPage,
  isSessionOpening,
  mergeLiveTranscript,
  projectClientTranscript,
} from "@features/session-workbench/lib/session-state.js"

describe("isSessionOpening", () => {
  it("lease 已齐但历史未到时仍算打开中，避免空画布闪一下", () => {
    expect(isSessionOpening("s2", "s2", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s1", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s2", "s2")).toBe(false)
    expect(isSessionOpening(undefined, undefined, undefined)).toBe(false)
  })
})

function row(id: string, role: "user" | "assistant", text: string): TranscriptItem {
  return { id, role, content: [{ type: "text", text }], timestamp: 0 } as TranscriptItem
}

describe("mergeLiveTranscript", () => {
  it("同 id 覆盖，新 id 追加；临时 id 对齐历史后缀", () => {
    const overlay = mergeLiveTranscript(
      [row("u1", "user", "a"), row("a1", "assistant", "old")],
      [row("a1", "assistant", "new"), row("a2", "assistant", "tail")],
    )

    expect(overlay.map((item) => item.id)).toEqual(["u1", "a1", "a2"])
    expect(overlay[1]).toMatchObject({ content: [{ type: "text", text: "new" }] })
    const history = [row("disk-u", "user", "ok"), row("disk-a", "assistant", "嗯。")]
    expect(
      mergeLiveTranscript(history, [row("m1", "user", "ok"), row("m2", "assistant", "嗯。")]).map(
        (item) => item.id,
      ),
    ).toEqual(["disk-u", "disk-a"])
    expect(
      mergeLiveTranscript(history.slice(0, 1), [
        row("m1", "user", "ok"),
        row("m2", "assistant", "嗯"),
      ]).map((item) => item.id),
    ).toEqual(["disk-u", "m2"])
  })

  it("新 Turn 的 live 条目追加在 markdown / Tool Call 历史之后", () => {
    const tool: ToolTranscriptItem = {
      id: "t1",
      role: "tool",
      toolCallId: "t1",
      toolName: "read",
      input: { path: "a.ts" },
      content: [{ type: "text", text: "out" }],
      timestamp: 3,
      status: "complete",
      isError: false,
    }
    const history = [
      row("u1", "user", "| a | b |\n| --- | --- |"),
      row("a1", "assistant", "$$E = mc^2$$"),
      tool,
    ]

    expect(
      mergeLiveTranscript(history, [row("u2", "user", "继续"), row("a2", "assistant", "好")]).map(
        (item) => item.id,
      ),
    ).toEqual(["u1", "a1", "t1", "u2", "a2"])
  })
})

describe("absorbLatestTranscriptPage", () => {
  const timing = (userId: string, startedAt: number) => ({
    userId,
    startedAt,
    endedAt: startedAt + 1,
    outcome: "complete" as const,
  })
  const ids = (items: readonly TranscriptItem[]) => items.map((item) => item.id)

  it("已加载窗口只增不缩", () => {
    const opened = absorbLatestTranscriptPage(undefined, {
      items: [row("u2", "user", "最近")],
      timings: [timing("u2", 2)],
      hasMore: true,
    })

    expect(ids(opened.items)).toEqual(["u2"])
    expect(opened.hasMore).toBe(true)
    expect(
      ids(absorbLatestTranscriptPage(opened, { items: [], timings: [], hasMore: false }).items),
    ).toEqual(["u2"])

    const first = absorbLatestTranscriptPage(undefined, {
      items: [row("u1", "user", "一"), row("a1", "assistant", "答")],
      timings: [timing("u1", 1)],
      hasMore: false,
    })
    const second = absorbLatestTranscriptPage(first, {
      items: [row("u2", "user", "二")],
      timings: [timing("u2", 2)],
      hasMore: true,
    })

    expect(ids(second.items)).toEqual(["u1", "a1", "u2"])
    expect(second.timings.map((item) => item.userId)).toEqual(["u1", "u2"])
    expect(second.hasMore).toBe(false)
  })
})

describe("projectClientTranscript", () => {
  const optimistic: UserTranscriptItem = {
    id: "user-1",
    role: "user",
    content: [{ type: "text", text: "新任务" }],
    timestamp: 2,
  }
  const previous: UserTranscriptItem = {
    id: "u1",
    role: "user",
    content: [{ type: "text", text: "旧任务" }],
    timestamp: 1,
  }
  const assistant = {
    id: "a1",
    role: "assistant",
    content: [{ type: "text", text: "处理中" }],
    status: "streaming",
    timestamp: 3,
  } as TranscriptItem
  const send = { item: optimistic, knownItemIds: [previous.id] }

  it("把本地用户句插在提交前历史之后、后续流式内容之前", () => {
    expect(projectClientTranscript([previous, assistant], [send]).map((item) => item.id)).toEqual([
      previous.id,
      optimistic.id,
      assistant.id,
    ])
  })

  it("服务端同文确认后仍用发送时的 id", () => {
    const confirmed = { ...optimistic, id: "server-u2" }
    const items = [previous, confirmed, assistant]
    expect(projectClientTranscript(items, [send]).map((item) => item.id)).toEqual([
      previous.id,
      optimistic.id,
      assistant.id,
    ])
  })

  it("已知历史之外的同文用户句不算确认", () => {
    const earlierDuplicate = { ...optimistic, id: "earlier-u0", timestamp: 0 }
    expect(
      projectClientTranscript([earlierDuplicate, previous, assistant], [send]).map(
        (item) => item.id,
      ),
    ).toEqual([earlierDuplicate.id, previous.id, optimistic.id, assistant.id])
  })
})
