import { describe, expect, it } from "vitest"
import {
  compactMinimapPreview,
  deriveTranscriptMinimapItems,
  MINIMAP_MIN_ITEMS,
  minimapRowInView,
  resolveMinimapHasPersistentGutter,
  resolveMinimapHeightStyle,
  resolveMinimapHitAreaWidth,
  resolveMinimapHitStripWidth,
  resolveMinimapIndexFromPointer,
  resolveMinimapTopPercent,
  sameIdList,
} from "@features/transcript-view/lib/transcript-minimap.js"

describe("compactMinimapPreview", () => {
  it("折叠空白；空串为 null", () => {
    expect(compactMinimapPreview("  hihi\n  jojo  ")).toBe("hihi jojo")
    expect(compactMinimapPreview("   ")).toBeNull()
    expect(compactMinimapPreview(undefined)).toBeNull()
  })
})

describe("deriveTranscriptMinimapItems", () => {
  it("只收录用户句，助手正文取该轮最后一句", () => {
    const items = deriveTranscriptMinimapItems([
      { id: "earlier", role: "earlier", text: "" },
      { id: "u1", role: "user", text: "hihi" },
      { id: "t1", role: "tool", text: "tool" },
      { id: "a1", role: "assistant", text: "第一答" },
      { id: "a2", role: "assistant", text: "嗨嗨, JoJo" },
      { id: "u2", role: "user", text: "jojo" },
      { id: "a3", role: "assistant", text: "" },
    ])
    expect(items).toEqual([
      {
        id: "u1",
        rowIndex: 1,
        userText: "hihi",
        assistantText: "嗨嗨, JoJo",
      },
      {
        id: "u2",
        rowIndex: 5,
        userText: "jojo",
        assistantText: null,
      },
    ])
    expect(items.length).toBeGreaterThanOrEqual(MINIMAP_MIN_ITEMS)
  })

  it("单条用户句仍派生，是否展示由 MINIMAP_MIN_ITEMS 决定", () => {
    expect(deriveTranscriptMinimapItems([{ id: "u1", role: "user", text: "hi" }])).toEqual([
      { id: "u1", rowIndex: 0, userText: "hi", assistantText: null },
    ])
  })
})

describe("minimap geometry", () => {
  it("刻度按 12px 槽位居中，指针落到所在槽", () => {
    expect(resolveMinimapHeightStyle(4)).toBe("min(48px, 80%)")
    expect(resolveMinimapTopPercent(0, 4)).toBe(12.5)
    expect(resolveMinimapTopPercent(3, 4)).toBe(87.5)
    expect(
      resolveMinimapIndexFromPointer({
        itemCount: 4,
        railTop: 100,
        railHeight: 48,
        pointerY: 100,
      }),
    ).toBe(0)
    expect(
      resolveMinimapIndexFromPointer({
        itemCount: 4,
        railTop: 100,
        railHeight: 48,
        pointerY: 147,
      }),
    ).toBe(3)
  })

  it("侧留白 >= 48px 才常驻；命中条为 44px 紧凑轨", () => {
    expect(resolveMinimapHasPersistentGutter(732)).toBe(false)
    expect(resolveMinimapHasPersistentGutter(828)).toBe(true)
    expect(resolveMinimapHitStripWidth(732)).toBe(0)
    expect(resolveMinimapHitStripWidth(828)).toBe(36)
    expect(resolveMinimapHitAreaWidth(0)).toBe(0)
    expect(resolveMinimapHitAreaWidth(36)).toBe(44)
  })

  it("行与视口相交才算 in-view", () => {
    expect(minimapRowInView(100, 40, 80, 200)).toBe(true)
    expect(minimapRowInView(200, 40, 80, 200)).toBe(false)
    expect(minimapRowInView(60, 40, 80, 200)).toBe(true)
    expect(sameIdList(["u1", "u2"], ["u1", "u2"])).toBe(true)
    expect(sameIdList(["u1"], ["u2"])).toBe(false)
  })
})
