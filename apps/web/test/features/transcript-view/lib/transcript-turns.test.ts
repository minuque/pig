import { describe, expect, it } from "vitest"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  groupTimelineTurns,
  reuseTimelineTurns,
} from "@features/transcript-view/lib/transcript-turns.js"

function assistant(id: string, text = "答"): TimelineRow {
  return {
    id,
    role: "assistant",
    text,
    streaming: false,
    error: false,
    aborted: false,
    timestamp: 0,
  }
}

function user(id: string): TimelineRow {
  return { id, role: "user", text: "问", images: [], timestamp: 0 }
}

describe("打开已有会话 → 时间线按轮切窗口项", () => {
  it("user 行开启新轮，无 user 前缀单独成一轮", () => {
    const orphan = assistant("a0")
    const u1 = user("u1")
    const a1 = assistant("a1")
    const u2 = user("u2")
    expect(groupTimelineTurns([orphan, u1, a1, u2])).toEqual([
      { id: "orphan:a0", rows: [orphan] },
      { id: "u1", rows: [u1, a1] },
      { id: "u2", rows: [u2] },
    ])
  })

  it("未变化的轮和行保持同一对象", () => {
    const u1 = user("u1")
    const a1 = assistant("a1")
    const first = groupTimelineTurns([u1, a1])
    const again = reuseTimelineTurns(first, groupTimelineTurns([u1, a1]))
    expect(again).toBe(first)
    expect(again[0]?.rows[0]).toBe(u1)
  })

  it("只换变化的轮，其它轮引用不变", () => {
    const u1 = user("u1")
    const a1 = assistant("a1")
    const u2 = user("u2")
    const previous = reuseTimelineTurns([], groupTimelineTurns([u1, a1, u2]))
    const next = reuseTimelineTurns(previous, groupTimelineTurns([u1, assistant("a1", "新"), u2]))
    expect(next[0]).not.toBe(previous[0])
    expect(next[1]).toBe(previous[1])
    expect(next[0]?.rows[0]).toBe(u1)
  })
})
