import { describe, expect, it } from "vitest";
import { nextThinkingLevel } from "@features/chat-input/components/ThinkingLevelSelect.vue";

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
