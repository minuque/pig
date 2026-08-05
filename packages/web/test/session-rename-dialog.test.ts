import { describe, expect, it } from "vitest";
import { canSubmitRename } from "../src/features/sessions/SessionRenameDialog.vue";

describe("canSubmitRename", () => {
  it("空白名称拒绝提交", () => {
    expect(canSubmitRename("")).toBe(false);
    expect(canSubmitRename("   ")).toBe(false);
  });

  it("非空名称允许提交", () => {
    expect(canSubmitRename("我的会话")).toBe(true);
    expect(canSubmitRename("  新名称  ")).toBe(true);
  });
});
