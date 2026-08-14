import { describe, expect, it } from "vitest";
import { sessionListName } from "../src/pi/session-label.js";

describe("sessionListName", () => {
  it("prefers the user-defined name", () => {
    expect(sessionListName({ name: "  卸载插件  ", firstMessage: "别的" })).toBe("卸载插件");
  });

  it("falls back to a truncated first message", () => {
    expect(sessionListName({ firstMessage: "帮我看一下这段报错" })).toBe("帮我看一下这段报错");
    expect(sessionListName({ firstMessage: `${"x".repeat(50)}` })?.endsWith("…")).toBe(true);
  });

  it("returns undefined when nothing is displayable", () => {
    expect(sessionListName({})).toBeUndefined();
    expect(sessionListName({ name: "   ", firstMessage: "  " })).toBeUndefined();
  });
});
