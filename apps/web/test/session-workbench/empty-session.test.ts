import { describe, expect, it } from "vitest"
import { isEmptyCanvas, isSessionLoading } from "@features/session-workbench/index.vue"

describe("isEmptyCanvas", () => {
  it("idle 或未定 phase 且无 transcript 时走居中空画布", () => {
    expect(isEmptyCanvas(0, "idle")).toBe(true)
    expect(isEmptyCanvas(0, undefined)).toBe(true)
  })

  it("有消息后不再走空画布", () => {
    expect(isEmptyCanvas(1, "idle")).toBe(false)
  })

  it("运行中即使无行也不走空画布", () => {
    expect(isEmptyCanvas(0, "turn")).toBe(false)
    expect(isEmptyCanvas(0, "compaction")).toBe(false)
  })

  it("Session 加载中不走空画布，避免把 loading 当成欢迎页", () => {
    expect(isEmptyCanvas(0, undefined, true)).toBe(false)
    expect(isEmptyCanvas(0, "idle", true)).toBe(false)
  })
})

describe("isSessionLoading", () => {
  it("远程未附加时保持遮罩", () => {
    expect(isSessionLoading(true, 0, false)).toBe(true)
    expect(isSessionLoading(true, 3, true)).toBe(true)
  })

  it("有 transcript 时等 markdown-stream 渲染完再撤遮罩", () => {
    expect(isSessionLoading(false, 3, false)).toBe(true)
    expect(isSessionLoading(false, 3, true)).toBe(false)
  })

  it("空会话不因 stream 未就绪而遮罩", () => {
    expect(isSessionLoading(false, 0, false)).toBe(false)
  })
})
