import type { TranscriptItem } from "@earendil-works/pi-protocol"
import { describe, expect, it } from "vitest"
import { pageTranscriptItems } from "../src/pi/transcript-page.js"

function item(id: string, role: "user" | "assistant"): TranscriptItem {
  return { id, role, timestamp: 1, content: [] } as TranscriptItem
}

describe("打开已有会话 → 历史分页", () => {
  it("默认返回最近三轮", () => {
    const items = [
      item("u1", "user"),
      item("a1", "assistant"),
      item("u2", "user"),
      item("a2", "assistant"),
      item("u3", "user"),
      item("a3", "assistant"),
      item("u4", "user"),
      item("a4", "assistant"),
    ]
    const page = pageTranscriptItems(items)
    expect(page.items.map((row) => row.id)).toEqual(["u2", "a2", "u3", "a3", "u4", "a4"])
    expect(page.hasMore).toBe(true)
  })

  it("不足三轮返回全文，没有更早页", () => {
    const items = [
      item("u1", "user"),
      item("a1", "assistant"),
      item("u2", "user"),
      item("a2", "assistant"),
    ]
    const page = pageTranscriptItems(items)
    expect(page.items.map((row) => row.id)).toEqual(["u1", "a1", "u2", "a2"])
    expect(page.hasMore).toBe(false)
  })

  it("before 取更早一轮", () => {
    const items = [
      item("u1", "user"),
      item("a1", "assistant"),
      item("u2", "user"),
      item("a2", "assistant"),
    ]
    const page = pageTranscriptItems(items, { before: "u2" })
    expect(page.items.map((row) => row.id)).toEqual(["u1", "a1"])
    expect(page.hasMore).toBe(false)
  })

  it("before 已是最早一条则没有更早页", () => {
    expect(pageTranscriptItems([item("u1", "user")], { before: "u1" })).toEqual({
      items: [],
      hasMore: false,
    })
  })
})
