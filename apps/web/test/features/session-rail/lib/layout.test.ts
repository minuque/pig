import { describe, expect, it } from "vitest"
import { railModeOf } from "@features/session-rail/lib/layout.js"

describe("railModeOf", () => {
  it("没有右侧面板时，正文放得下最小宽就常驻", () => {
    expect(railModeOf(1011)).toBe("popover")
    expect(railModeOf(1012)).toBe("docked")
  })
})
