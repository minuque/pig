import { describe, expect, it } from "vitest";
import { isEmptyCanvas } from "@features/session-workbench/index.vue";

describe("isEmptyCanvas", () => {
  it("idle 或未定 phase 且无 transcript 时走居中空画布", () => {
    expect(isEmptyCanvas(0, "idle")).toBe(true);
    expect(isEmptyCanvas(0, undefined)).toBe(true);
  });

  it("有消息后不再走空画布", () => {
    expect(isEmptyCanvas(1, "idle")).toBe(false);
  });

  it("运行中即使无行也不走空画布", () => {
    expect(isEmptyCanvas(0, "turn")).toBe(false);
    expect(isEmptyCanvas(0, "compaction")).toBe(false);
  });
});
