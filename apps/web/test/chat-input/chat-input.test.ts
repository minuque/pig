import { describe, expect, it } from "vitest";
import { canSend } from "@features/chat-input/index.vue";

describe("canSend", () => {
  it("有正文且未被禁用才可发送", () => {
    expect(canSend("  hi  ", false)).toBe(true);
  });

  it("空白正文拒绝", () => {
    expect(canSend("   ", false)).toBe(false);
  });

  it("外部禁用拒绝", () => {
    expect(canSend("hi", true)).toBe(false);
  });

  it("仅附件可发送", () => {
    expect(canSend("   ", false, 1)).toBe(true);
  });

  it("附件加外部禁用仍拒绝", () => {
    expect(canSend("hi", true, 2)).toBe(false);
    expect(canSend("   ", true, 1)).toBe(false);
  });
});
