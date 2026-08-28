import { describe, expect, it } from "vitest"
import {
  CONTENT_ADAPTIVE_CAP,
  CONTENT_ADAPTIVE_FLOOR,
  CONTENT_DRAG_MIN,
  CONTENT_EDGE_BUDGET,
  parseContentWidth,
  resolveContentWidth,
} from "@features/session-workbench/hooks/use-conversation-width.js"

describe("parseContentWidth", () => {
  it("非正有限数丢弃", () => {
    expect(parseContentWidth(null)).toBeNull()
    expect(parseContentWidth("")).toBeNull()
    expect(parseContentWidth("nope")).toBeNull()
    expect(parseContentWidth("0")).toBeNull()
    expect(parseContentWidth("-8")).toBeNull()
    expect(parseContentWidth("720")).toBe(720)
  })
})

describe("resolveContentWidth", () => {
  it("无偏好时钉在 680 / 64% / 920 平台", () => {
    expect(resolveContentWidth(800, null)).toBe(CONTENT_ADAPTIVE_FLOOR)
    expect(resolveContentWidth(2000, null)).toBe(CONTENT_ADAPTIVE_CAP)
    expect(resolveContentWidth(1200, null)).toBe(1200 * 0.64)
  })

  it("有偏好时不越过下限和列侧预算", () => {
    expect(resolveContentWidth(1600, 800)).toBe(800)
    expect(resolveContentWidth(1600, 200)).toBe(CONTENT_DRAG_MIN)
    expect(resolveContentWidth(1600, 2000)).toBe(1600 - CONTENT_EDGE_BUDGET)
    expect(resolveContentWidth(800, 900)).toBe(CONTENT_DRAG_MIN)
  })
})
