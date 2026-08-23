import { describe, expect, it } from "vitest";
import {
  nextThinkingLevel,
  thinkingBarOpacities,
  thinkingGlow,
} from "@features/chat-input/components/ThinkingLevelSelect.vue";

const full = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

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

describe("thinkingGlow", () => {
  it("off 为 0，最高有效档为 1，中间按有效档比例", () => {
    expect(thinkingGlow("off", full)).toBe(0);
    expect(thinkingGlow("minimal", full)).toBe(0);
    expect(thinkingGlow("max", full)).toBe(1);
    expect(thinkingGlow("medium", full)).toBeCloseTo(2 / 5);
  });

  it("没有 off 时最低档为暗、最高档为亮", () => {
    expect(thinkingGlow("low", ["low", "medium", "high"])).toBe(0);
    expect(thinkingGlow("high", ["low", "medium", "high"])).toBe(1);
  });

  it("仅一档有效时为最亮", () => {
    expect(thinkingGlow("on", ["off", "on"])).toBe(1);
  });
});

describe("thinkingBarOpacities", () => {
  it("off 三根全灭", () => {
    expect(thinkingBarOpacities("off", full)).toEqual([0, 0, 0]);
  });

  it("最低有效档亮第一根，最高有效档三根全亮", () => {
    expect(thinkingBarOpacities("minimal", full)).toEqual([1, 0.28, 0.28]);
    expect(thinkingBarOpacities("max", full)).toEqual([1, 1, 1]);
  });
});
