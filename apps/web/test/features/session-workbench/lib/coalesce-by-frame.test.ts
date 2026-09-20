import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { coalesceByFrame } from "@features/session-workbench/lib/coalesce-by-frame.js"

describe("coalesceByFrame", () => {
  let rafQueue: FrameRequestCallback[]

  beforeEach(() => {
    vi.useFakeTimers()
    rafQueue = []
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  function flushFrame() {
    const queue = rafQueue
    rafQueue = []
    queue.forEach((cb) => cb(0))
  }

  it("一帧内多次 push 只发布最后一次，且不会重复发布", () => {
    const published: number[] = []
    const { push } = coalesceByFrame<number>((value) => published.push(value))
    push(1)
    push(2)
    push(3)
    expect(published).toEqual([])

    flushFrame()
    expect(published).toEqual([3])

    vi.advanceTimersByTime(32)
    expect(published).toEqual([3])
  })

  it("帧回调不可用时用超时兜底", () => {
    vi.stubGlobal("requestAnimationFrame", undefined)
    const published: number[] = []
    const { push } = coalesceByFrame<number>((value) => published.push(value))
    push(1)
    push(2)

    vi.advanceTimersByTime(32)
    expect(published).toEqual([2])
  })

  it("publish 之间跨帧各自发布", () => {
    const published: number[] = []
    const { push } = coalesceByFrame<number>((value) => published.push(value))
    push(1)
    flushFrame()
    push(2)
    flushFrame()
    expect(published).toEqual([1, 2])
  })

  it("cancel 丢弃未发布的值，之后还能继续用", () => {
    const published: number[] = []
    const { push, cancel } = coalesceByFrame<number>((value) => published.push(value))
    push(1)
    cancel()
    flushFrame()
    vi.advanceTimersByTime(32)
    expect(published).toEqual([])

    push(2)
    flushFrame()
    expect(published).toEqual([2])
  })
})
