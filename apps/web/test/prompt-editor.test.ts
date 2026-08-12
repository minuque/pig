import { describe, expect, it } from "vitest";
import { enhanceLabel, shouldSubmitOnKeydown } from "../src/components/composer/PromptEditor.vue";

describe("shouldSubmitOnKeydown", () => {
  it("裸 Enter 触发提交", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
  });

  it("Shift+Enter 换行不提交", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
  });

  it("IME 组合期间放行", () => {
    expect(shouldSubmitOnKeydown({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });

  it("非 Enter 键不提交", () => {
    expect(shouldSubmitOnKeydown({ key: "a", shiftKey: false, isComposing: false })).toBe(false);
  });
});

describe("enhanceLabel", () => {
  it("enhanced 态切换为 Revert", () => {
    expect(enhanceLabel("enhanced")).toBe("Revert");
    expect(enhanceLabel("idle")).toBe("Enhance Prompt");
  });
});
