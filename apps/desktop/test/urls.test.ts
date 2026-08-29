import { describe, expect, it } from "vitest"
import { appUrl, gatewayOrigin, isDesktopDev } from "../src/main/urls.js"

describe("urls", () => {
  it("gatewayOrigin 组装 loopback", () => {
    expect(gatewayOrigin(1234)).toBe("http://127.0.0.1:1234")
  })

  it("合法平台写入 pig-desktop-platform query", () => {
    for (const platform of ["darwin", "win32", "linux"] as const) {
      const href = appUrl("http://127.0.0.1:5173", platform)
      expect(new URL(href).searchParams.get("pig-desktop-platform")).toBe(platform)
    }
  })

  it("非法或缺省平台不加 pig-desktop-platform", () => {
    expect(new URL(appUrl("http://127.0.0.1:5173")).searchParams.has("pig-desktop-platform")).toBe(
      false,
    )
    expect(
      new URL(appUrl("http://127.0.0.1:5173", "freebsd")).searchParams.has("pig-desktop-platform"),
    ).toBe(false)
    expect(
      new URL(appUrl("http://127.0.0.1:5173", "")).searchParams.has("pig-desktop-platform"),
    ).toBe(false)
  })

  it("isDesktopDev 识别 --dev", () => {
    expect(isDesktopDev(["electron", "--dev"])).toBe(true)
    expect(isDesktopDev(["electron"])).toBe(false)
  })
})
