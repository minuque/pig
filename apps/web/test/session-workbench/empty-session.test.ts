import { describe, expect, it } from "vitest"
import { isEmptyCanvas } from "@features/session-workbench/index.vue"

describe("isEmptyCanvas", () => {
  it("idle 或未定 phase 且无 transcript 时走居中空画布", () => {
    expect(isEmptyCanvas(0, false)).toBe(true)
  })

  it("有消息后不再走空画布", () => {
    expect(isEmptyCanvas(1, false)).toBe(false)
  })

  it("运行中即使无行也不走空画布", () => {
    expect(isEmptyCanvas(0, true)).toBe(false)
  })

  it("Session 加载中不走空画布，避免把 loading 当成欢迎页", () => {
    expect(isEmptyCanvas(0, false, true)).toBe(false)
  })
})
