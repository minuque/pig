import { describe, expect, it } from "vitest"
import type { ToolTranscriptItem, TranscriptItem, UserTranscriptItem } from "@/types/common-type.js"
import {
  isSessionOpening,
  mergeLiveTranscript,
  projectOptimisticTranscript,
} from "@features/session-workbench/lib/session-state.js"

describe("isSessionOpening", () => {
  it("lease 已齐但历史未到时仍算打开中，避免空画布闪一下", () => {
    expect(isSessionOpening("s2", "s2", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s1", undefined)).toBe(true)
    expect(isSessionOpening("s2", "s2", "s2")).toBe(false)
    expect(isSessionOpening(undefined, undefined, undefined)).toBe(false)
  })
})

describe("mergeLiveTranscript", () => {
  const row = (id: string, role: "user" | "assistant", text: string): TranscriptItem =>
    ({ id, role, content: [{ type: "text", text }], timestamp: 0 }) as TranscriptItem

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

describe("projectOptimisticTranscript", () => {
  const optimistic: UserTranscriptItem = {
    id: "optimistic-1",
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

  it("把乐观用户句插在提交前历史之后、后续流式内容之前", () => {
    expect(
      projectOptimisticTranscript([previous, assistant], {
        item: optimistic,
        knownItemIds: [previous.id],
      }).map((item) => item.id),
    ).toEqual([previous.id, optimistic.id, assistant.id])
  })

  it("收到新的同文服务端用户句后移除乐观投影", () => {
    const confirmed = { ...optimistic, id: "server-u2" }
    const items = [previous, confirmed, assistant]
    expect(
      projectOptimisticTranscript(items, {
        item: optimistic,
        knownItemIds: [previous.id],
      }),
    ).toBe(items)
  })

  it("已知历史之外的同文用户句不算确认", () => {
    const earlierDuplicate = { ...optimistic, id: "earlier-u0", timestamp: 0 }
    expect(
      projectOptimisticTranscript([earlierDuplicate, previous, assistant], {
        item: optimistic,
        knownItemIds: [previous.id],
      }).map((item) => item.id),
    ).toEqual([earlierDuplicate.id, previous.id, optimistic.id, assistant.id])
  })
})
