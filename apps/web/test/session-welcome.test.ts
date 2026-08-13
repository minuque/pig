import { describe, expect, it } from "vitest";
import { canSubmit } from "../src/features/sessions/SessionWelcome.vue";

describe("canSubmit", () => {
  const profile = { model: "gpt-5", thinkingLevel: "high" };

  it("满足全部条件才可提交", () => {
    expect(canSubmit("  写个脚本  ", "w1", profile, false)).toBe(true);
  });

  it("空白 prompt 拒绝", () => {
    expect(canSubmit("   ", "w1", profile, false)).toBe(false);
  });

  it("无 workspace 拒绝", () => {
    expect(canSubmit("任务", undefined, profile, false)).toBe(false);
  });

  it("无 profile 拒绝", () => {
    expect(canSubmit("任务", "w1", undefined, false)).toBe(false);
  });

  it("提交中拒绝", () => {
    expect(canSubmit("任务", "w1", profile, true)).toBe(false);
  });
});
