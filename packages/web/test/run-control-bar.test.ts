import { describe, expect, it } from "vitest";
import { cancelLabel } from "../src/features/runs/RunControlBar.vue";

describe("cancelLabel", () => {
  it("未取消时显示固定文案", () => {
    expect(cancelLabel(false)).toBe("取消 Run");
  });

  it("取消中切换为进行中文案", () => {
    expect(cancelLabel(true)).toBe("取消中…");
  });
});
