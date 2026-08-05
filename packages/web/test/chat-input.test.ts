import { describe, expect, it } from "vitest";
import { canSend, canSteer } from "../src/features/runs/ChatInput.vue";

describe("canSend", () => {
  it("有正文且各条件满足才可发送", () => {
    expect(canSend("  hi  ", false, false, false)).toBe(true);
  });

  it("空白正文拒绝", () => {
    expect(canSend("   ", false, false, false)).toBe(false);
  });

  it("增强中拒绝", () => {
    expect(canSend("hi", true, false, false)).toBe(false);
  });

  it("会话不可用拒绝", () => {
    expect(canSend("hi", false, true, false)).toBe(false);
  });

  it("外部禁用拒绝", () => {
    expect(canSend("hi", false, false, true)).toBe(false);
  });
});

describe("canSteer", () => {
  it("有正文且会话可用才可 Steer", () => {
    expect(canSteer("  hi  ", false)).toBe(true);
  });

  it("空白正文拒绝", () => {
    expect(canSteer("   ", false)).toBe(false);
  });

  it("会话不可用拒绝", () => {
    expect(canSteer("hi", true)).toBe(false);
  });
});
