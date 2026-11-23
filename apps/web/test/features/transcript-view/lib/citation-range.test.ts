import { describe, expect, it } from "vitest"
import { findCitationText, rawTextOffset } from "@features/transcript-view/lib/citation-range.js"

describe("citation-range", () => {
  it("maps normalized offsets back to raw text positions", () => {
    const raw = "hello   world\n\nfoo"

    expect(rawTextOffset(raw, 0)).toBe(0)
    expect(rawTextOffset(raw, 5)).toBe(5)
    expect(rawTextOffset(raw, 6)).toBe(8)
    expect(rawTextOffset(raw, 11)).toBe(13)
    expect(rawTextOffset(raw, 12)).toBe(15)
    expect(rawTextOffset(raw, 15)).toBe(18)
  })

  it("finds quote across collapsed whitespace and paragraph breaks", () => {
    const stream = "第一段说明\n\n修法很小：先在  runTool\n里检查参数。"
    const hit = findCitationText(stream, "修法很小：先在 runTool 里检查参数。")

    expect(hit).not.toBeNull()
    expect(rawTextOffset(stream, hit!.start)).toBe(7)
    expect(rawTextOffset(stream, hit!.end)).toBe(stream.length)
  })

  it("returns null for empty or unmatched quotes", () => {
    expect(findCitationText("任意文本", "")).toBeNull()
    expect(findCitationText("任意文本", "   ")).toBeNull()
    expect(findCitationText("任意文本", "不存在的片段")).toBeNull()
  })
})
