import { describe, expect, it } from "vitest"

import { parseThemeColor } from "../src/main/theme-color.js"

describe("parseThemeColor", () => {
  it("接受 #rgb 和 #rrggbb", () => {
    expect(parseThemeColor("#161413")).toBe("#161413")
    expect(parseThemeColor("#fff")).toBe("#fff")
    expect(parseThemeColor("#AbC")).toBe("#AbC")
  })

  it("接受 getComputedStyle 返回的 rgb 和 rgba", () => {
    expect(parseThemeColor("rgb(22, 20, 19)")).toBe("rgb(22, 20, 19)")
    expect(parseThemeColor("rgba(22, 20, 19, 1)")).toBe("rgba(22, 20, 19, 1)")
    expect(parseThemeColor("  rgb(0, 0, 0) ")).toBe("rgb(0, 0, 0)")
  })

  it("拒绝非法值", () => {
    expect(parseThemeColor("#161413ff")).toBeUndefined()
    expect(parseThemeColor("161413")).toBeUndefined()
    expect(parseThemeColor("red")).toBeUndefined()
    expect(parseThemeColor("rgb(0 0 0)")).toBeUndefined()
    expect(parseThemeColor("")).toBeUndefined()
    expect(parseThemeColor(null)).toBeUndefined()
    expect(parseThemeColor(161413)).toBeUndefined()
  })
})
