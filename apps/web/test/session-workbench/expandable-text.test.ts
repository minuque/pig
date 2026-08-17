import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAX_EXPAND_LINES,
  DEFAULT_OVERSCAN_LINES,
  shouldVirtualizeMarkdown,
  splitLines,
  visibleLineRange,
} from "@features/session-workbench/lib/expandable-text.js";

describe("splitLines", () => {
  it("空串没有行", () => {
    expect(splitLines("")).toEqual([]);
  });

  it("按换行切开，保留空行", () => {
    expect(splitLines("a\n\nb")).toEqual(["a", "", "b"]);
  });
});

describe("visibleLineRange", () => {
  it("视口内最多 viewportLines+overscan，不超出总行数", () => {
    const range = visibleLineRange(0, 21, 32, 2000, 8);
    expect(range.end - range.start).toBeLessThanOrEqual(32 + 8);
    expect(range.start).toBe(0);
    expect(range.end).toBe(40);
  });

  it("滚动后窗口跟着走，仍不超过 max expand", () => {
    const range = visibleLineRange(21 * 100, 21, DEFAULT_MAX_EXPAND_LINES, 2000, 8);
    expect(range.start).toBe(92);
    expect(range.end).toBe(140);
    expect(range.end - range.start).toBeLessThanOrEqual(
      DEFAULT_MAX_EXPAND_LINES + 2 * DEFAULT_OVERSCAN_LINES,
    );
  });

  it("短文本不切片", () => {
    expect(visibleLineRange(0, 21, 32, 10, 8)).toEqual({ start: 0, end: 10 });
  });
});

describe("shouldVirtualizeMarkdown", () => {
  it("短回复不启用节点虚拟滚动", () => {
    expect(shouldVirtualizeMarkdown("hello")).toBe(false);
  });

  it("超长正文启用", () => {
    expect(shouldVirtualizeMarkdown("x".repeat(8001))).toBe(true);
    expect(shouldVirtualizeMarkdown(Array.from({ length: 81 }, () => "line").join("\n"))).toBe(
      true,
    );
  });
});
