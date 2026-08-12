import { describe, expect, it } from "vitest";
import { canSend } from "../src/components/composer/ChatInput.vue";

describe("canSend", () => {
  it("有正文且各条件满足才可发送", () => {
    expect(canSend("  hi  ", false, false)).toBe(true);
  });

  it("空白正文拒绝", () => {
    expect(canSend("   ", false, false)).toBe(false);
  });

  it("增强中拒绝", () => {
    expect(canSend("hi", true, false)).toBe(false);
  });

  it("外部禁用拒绝", () => {
    expect(canSend("hi", false, true)).toBe(false);
  });
});
