import { describe, expect, it } from "vitest";
import {
  nextThinkingLevel,
  thinkingBarOpacities,
  thinkingDepth,
} from "@features/chat-input/components/ThinkingLevelSelect.vue";

describe("nextThinkingLevel", () => {
  it("按数组循环到下一档", () => {
    expect(nextThinkingLevel(["low", "medium", "high"], "low")).toBe("medium");
    expect(nextThinkingLevel(["low", "medium", "high"], "medium")).toBe("high");
    expect(nextThinkingLevel(["low", "medium", "high"], "high")).toBe("low");
  });

  it("两档同样循环", () => {
    expect(nextThinkingLevel(["low", "high"], "low")).toBe("high");
    expect(nextThinkingLevel(["low", "high"], "high")).toBe("low");
  });

  it("未知当前档落到 0", () => {
    expect(nextThinkingLevel(["low", "high"], "max")).toBe("low");
    expect(nextThinkingLevel(["off", "on"], "")).toBe("off");
  });
});

describe("thinkingDepth", () => {
  it("最低档为 0、最高档为 1，中间按比例", () => {
    expect(thinkingDepth(0, 4)).toBe(0);
    expect(thinkingDepth(1, 4)).toBeCloseTo(1 / 3);
    expect(thinkingDepth(3, 4)).toBe(1);
  });

  it("单档或空档为 0", () => {
    expect(thinkingDepth(0, 1)).toBe(0);
    expect(thinkingDepth(0, 0)).toBe(0);
  });
});

describe("thinkingBarOpacities", () => {
  it("最低档只亮第一根，最高档三根全亮", () => {
    expect(thinkingBarOpacities(0, 3)).toEqual([1, 0.28, 0.28]);
    expect(thinkingBarOpacities(2, 3)).toEqual([1, 1, 1]);
  });
});
