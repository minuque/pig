import { describe, expect, it } from "vitest"
import { gatewayOrigin, isDesktopDev } from "../src/main/urls.js"

describe("urls", () => {
  it("gatewayOrigin 组装 loopback", () => {
    expect(gatewayOrigin(1234)).toBe("http://127.0.0.1:1234")
  })

  it("isDesktopDev 识别 --dev", () => {
    expect(isDesktopDev(["electron", "--dev"])).toBe(true)
    expect(isDesktopDev(["electron"])).toBe(false)
  })
})
