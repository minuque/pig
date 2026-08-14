import { describe, expect, it } from "vitest";
import { bootstrapAppUrl, gatewayOrigin, isDesktopDev } from "../src/main/urls.js";

describe("urls", () => {
  it("gatewayOrigin 组装 loopback", () => {
    expect(gatewayOrigin(1234)).toBe("http://127.0.0.1:1234");
  });

  it("bootstrapAppUrl 的 hash 可被 URLSearchParams 解出含空格的 secret", () => {
    const href = bootstrapAppUrl("http://127.0.0.1:5173", "abc def");
    expect(new URLSearchParams(new URL(href).hash.slice(1)).get("bootstrap")).toBe("abc def");
  });

  it("合法平台写入 pig-desktop-platform query，hash 仍可解 secret", () => {
    for (const platform of ["darwin", "win32", "linux"] as const) {
      const href = bootstrapAppUrl("http://127.0.0.1:5173", "abc def", platform);
      const url = new URL(href);
      expect(url.searchParams.get("pig-desktop-platform")).toBe(platform);
      expect(new URLSearchParams(url.hash.slice(1)).get("bootstrap")).toBe("abc def");
    }
  });

  it("非法或缺省平台不加 pig-desktop-platform", () => {
    expect(
      new URL(bootstrapAppUrl("http://127.0.0.1:5173", "s")).searchParams.has(
        "pig-desktop-platform",
      ),
    ).toBe(false);
    expect(
      new URL(bootstrapAppUrl("http://127.0.0.1:5173", "s", "freebsd")).searchParams.has(
        "pig-desktop-platform",
      ),
    ).toBe(false);
    expect(
      new URL(bootstrapAppUrl("http://127.0.0.1:5173", "s", "")).searchParams.has(
        "pig-desktop-platform",
      ),
    ).toBe(false);
  });

  it("isDesktopDev 识别 --dev", () => {
    expect(isDesktopDev(["electron", "--dev"])).toBe(true);
    expect(isDesktopDev(["electron"])).toBe(false);
  });
});
