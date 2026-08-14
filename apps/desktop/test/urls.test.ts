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

  it("isDesktopDev 识别 --dev", () => {
    expect(isDesktopDev(["electron", "--dev"])).toBe(true);
    expect(isDesktopDev(["electron"])).toBe(false);
  });
});
