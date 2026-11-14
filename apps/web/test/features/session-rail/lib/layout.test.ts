import { describe, expect, it } from "vitest"
import { railModeOf } from "@features/session-rail/lib/layout.js"

describe("railModeOf", () => {
  it("没有右侧面板时，正文放得下最小宽就常驻", () => {
    expect(railModeOf(1011)).toBe("popover")
    expect(railModeOf(1012)).toBe("docked")
  })

  it("右侧面板开着时再让出它的宽度", () => {
    expect(railModeOf(1463, { wide: false })).toBe("popover")
    expect(railModeOf(1464, { wide: false })).toBe("docked")
    expect(railModeOf(1903, { wide: true })).toBe("popover")
    expect(railModeOf(1904, { wide: true })).toBe("docked")
  })
})
