import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"

const lifecycle = vi.hoisted(() => ({ unmount: () => {} }))

vi.mock("vue", async (original) => ({
  ...(await original<typeof import("vue")>()),
  onBeforeUnmount: (callback: () => void) => {
    lifecycle.unmount = callback
  },
}))

let now = 0

let sequence = 0

const frames = new Map<number, FrameRequestCallback>()

function frame(ms = 1000 / 60) {
  now += ms
  const pending = [...frames.values()]
  frames.clear()

  for (const callback of pending) callback(now)
}

function fixture() {
  let top = 600
  let follow: ReturnType<typeof useTranscriptFollow>

  const root = {
    scrollHeight: 1000,
    clientHeight: 400,
    get scrollTop() {
      return top
    },
    set scrollTop(value: number) {
      top = Math.round(Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)))
      follow?.onScroll()
    },
  }

  follow = useTranscriptFollow(() => root as HTMLElement)
  follow.scrollToLatest()
  return { root, follow }
}

beforeEach(() => {
  now = 0
  sequence = 0
  frames.clear()
  vi.spyOn(performance, "now").mockImplementation(() => now)
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
})

afterEach(() => {
  lifecycle.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("一轮工作：流式视口跟随", () => {
  it("增高合并到唯一帧循环并贴底", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)
    expect(root.scrollTop).toBe(600)

    for (let index = 0; index < 60; index++) frame()
    expect(root.scrollTop).toBe(840)
    expect(follow.atBottom.value).toBe(true)
    expect(follow.visuallyAtBottom.value).toBe(true)
    expect(frames.size).toBe(0)
  })

  it("失败路径：自身写滚动不重启循环", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    frame()
    expect(frames.size).toBe(1)
    expect(root.scrollTop).toBeGreaterThan(600)
    expect(root.scrollTop).toBeLessThan(700)
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)
  })

  it("失败路径：用户上翻后不再抢滚动，显式回到底部才恢复", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    frame()
    root.scrollTop -= 80
    follow.onScroll()
    const stopped = root.scrollTop
    expect(follow.atBottom.value).toBe(false)
    root.scrollHeight += 240
    follow.pinIfNeeded()
    frame()
    expect(root.scrollTop).toBe(stopped)
    expect(frames.size).toBe(0)
    follow.scrollToLatest()
    expect(root.scrollTop).toBe(1080)
    expect(follow.atBottom.value).toBe(true)
  })

  it("失败路径：滚动事件尚未派发时也不覆盖用户上翻", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    root.scrollTop -= 80
    frame()
    expect(root.scrollTop).toBe(520)
    expect(follow.atBottom.value).toBe(false)
    expect(frames.size).toBe(0)
  })

  it("内容收缩的浏览器钳位不被误认为上翻", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    frame()
    root.scrollHeight = 800
    root.scrollTop = root.scrollHeight - root.clientHeight
    follow.onScroll()
    frame()
    expect(root.scrollTop).toBe(400)
    expect(follow.atBottom.value).toBe(true)
    expect(frames.size).toBe(0)
  })

  it("切换会话和卸载清理帧循环，不保留旧速度", () => {
    const { root, follow } = fixture()
    root.scrollHeight += 240
    follow.pinIfNeeded()
    frame()
    follow.reset()
    expect(frames.size).toBe(0)
    expect(follow.atBottom.value).toBe(false)
    follow.scrollToLatest()
    root.scrollHeight += 100
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)
    lifecycle.unmount()
    expect(frames.size).toBe(0)
  })
})
