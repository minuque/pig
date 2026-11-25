import { describe, expect, it } from "vitest"
import { isTextOverflowing, shouldCancelOverflowOpen } from "../../src/ui/tooltip/overflow.js"

describe("OverflowTooltip 溢出判定", () => {
  it("文本未溢出或仅 1px 舍入误差时不触发", () => {
    expect(isTextOverflowing(null)).toBe(false)
    expect(isTextOverflowing({ scrollWidth: 160, clientWidth: 160 })).toBe(false)
    expect(isTextOverflowing({ scrollWidth: 161, clientWidth: 160 })).toBe(false)
    expect(shouldCancelOverflowOpen(true, { scrollWidth: 161, clientWidth: 160 })).toBe(true)
  })

  it("文本真实截断或 always=true 时允许打开", () => {
    expect(isTextOverflowing({ scrollWidth: 448, clientWidth: 364 })).toBe(true)
    expect(shouldCancelOverflowOpen(true, { scrollWidth: 448, clientWidth: 364 })).toBe(false)
    expect(shouldCancelOverflowOpen(true, { scrollWidth: 100, clientWidth: 100 }, true)).toBe(false)
    expect(shouldCancelOverflowOpen(false, { scrollWidth: 100, clientWidth: 100 })).toBe(false)
  })
})
