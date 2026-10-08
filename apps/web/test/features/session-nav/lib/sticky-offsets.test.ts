import { describe, expect, it } from "vitest"
import { stickyOffsets } from "@features/session-nav/lib/sticky-offsets.js"

describe("侧栏吸顶偏移", () => {
  it("扣掉置顶区的底边距，避免表头吸顶时向上跳", () => {
    // 置顶区 256 含 4px 底边距，表头高 28，容器内边距 24
    const offsets = stickyOffsets(256, 28, 4, 24)

    expect(offsets.pin).toBe(252)
    expect(offsets.head).toBe(280)
  })

  it("置顶区高于容器内边距时补足尾部留白", () => {
    const offsets = stickyOffsets(256, 28, 4, 24)

    // 不补的话滚到底时置顶区会被顶出视口
    expect(offsets.tail).toBe(256)
  })

  it("没有置顶区时只留表头自己的高度", () => {
    const offsets = stickyOffsets(0, 28, 4, 24)

    expect(offsets.pin).toBe(0)
    expect(offsets.head).toBe(28)
    expect(offsets.tail).toBe(4)
  })
})
