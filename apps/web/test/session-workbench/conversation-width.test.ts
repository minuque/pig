import { describe, expect, it } from "vitest"
import {
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
  it("有偏好时不越过下限和列侧预算", () => {
    expect(resolveContentWidth(1600, 800)).toBe(800)
    expect(resolveContentWidth(1600, 200)).toBe(CONTENT_DRAG_MIN)
    expect(resolveContentWidth(1600, 2000)).toBe(1600 - CONTENT_EDGE_BUDGET)
    expect(resolveContentWidth(800, 900)).toBe(CONTENT_DRAG_MIN)
  })
})
