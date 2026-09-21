import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"

const lifecycle = vi.hoisted(() => ({ mount: () => {}, unmount: () => {} }))

vi.mock("vue", async (original) => ({
  ...(await original<typeof import("vue")>()),
  onMounted: (callback: () => void) => {
    lifecycle.mount = callback
  },
  onBeforeUnmount: (callback: () => void) => {
    lifecycle.unmount = callback
  },
}))

let now = 0
let sequence = 0
const frames = new Map<number, FrameRequestCallback>()
const windowEvents = new Map<string, EventListener>()

function frame(ms = 1000 / 60) {
  now += ms
  const pending = [...frames.values()]

  frames.clear()

  for (const callback of pending) callback(now)
}

function advance(count: number) {
  for (let index = 0; index < count; index += 1) frame()
}

/** 走完收敛循环：帧数够多时循环自己会停。 */
function settleFully() {
  advance(8)
}

function fixture() {
  let top = 600
  let follow: ReturnType<typeof useTranscriptFollow>
  const rect = { right: 500, left: 0, top: 0, bottom: 400, width: 500, height: 400 }
  const root = {
    scrollHeight: 1000,
    clientHeight: 400,
    offsetWidth: 500,
    clientWidth: 400,
    getBoundingClientRect: () => rect as DOMRect,
    get scrollTop() {
      return top
    },
    set scrollTop(value: number) {
      top = Math.round(Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)))
      follow?.onScroll()
    },
  }

  follow = useTranscriptFollow(() => root as unknown as HTMLElement)
  lifecycle.mount()
  follow.scrollToLatest()
  settleFully()
  return { root, follow, rect }
}

beforeEach(() => {
  now = 0
  sequence = 0
  frames.clear()
  windowEvents.clear()
  vi.spyOn(performance, "now").mockImplementation(() => now)
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false }),
    addEventListener: (type: string, handler: EventListener) => windowEvents.set(type, handler),
    removeEventListener: (type: string) => windowEvents.delete(type),
    setTimeout: (handler: () => void, ms: number) => setTimeout(handler, ms),
    clearTimeout: (id: number) => clearTimeout(id),
  })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback)
    return sequence
  })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id))
  vi.stubGlobal("Node", class NodeStub {})
})

afterEach(() => {
  lifecycle.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("一轮工作：流式视口跟随", () => {
  it("打开会话贴底，内容增高按帧收敛到新底部", () => {
    const { root, follow } = fixture()

    expect(root.scrollTop).toBe(600)
    expect(follow.atBottom.value).toBe(true)
    expect(frames.size).toBe(0)
    root.scrollHeight += 24
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(624)
    expect(follow.atBottom.value).toBe(true)
    settleFully()
    expect(frames.size).toBe(0)
    expect(follow.visuallyAtBottom.value).toBe(true)
  })

  it("布局连续变化时一直跟，稳定后停下", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()

    for (let index = 0; index < 20; index += 1) {
      root.scrollHeight += 8
      frame()
    }

    expect(follow.atBottom.value).toBe(true)
    expect(root.scrollTop).toBe(root.scrollHeight - 400)
    advance(4)
    expect(frames.size).toBe(0)
    expect(root.scrollTop).toBe(root.scrollHeight - 400)
  })

  it("失败路径：冷却只忽略自身写入的回声，越过写入位置算用户接管", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    root.scrollTop = 600
    expect(follow.atBottom.value).toBe(true)
    root.scrollTop = 300
    frame()
    frame()
    expect(follow.atBottom.value).toBe(false)
    settleFully()
    expect(root.scrollTop).toBe(300)
  })

  it("失败路径：用户上翻超过半屏脱底后不再抢滚动，滚回底部附近重新吸附", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    advance(80)
    root.scrollTop -= 300
    frame()
    frame()
    expect(follow.atBottom.value).toBe(false)
    expect(root.scrollTop).toBe(300)
    follow.pinIfNeeded()
    settleFully()
    expect(root.scrollTop).toBe(300)
    root.scrollTop = root.scrollHeight - root.clientHeight - 40
    expect(follow.atBottom.value).toBe(false)
    frame()
    frame()
    expect(follow.atBottom.value).toBe(true)
    expect(root.scrollTop).toBe(600)
  })

  it("失败路径：按在滚动条热区立刻脱底，按住期间不重新吸附", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    advance(80)
    follow.onPointerDown({ clientX: 495, button: 0 } as PointerEvent)
    expect(follow.atBottom.value).toBe(false)
    root.scrollHeight += 200
    follow.pinIfNeeded()
    settleFully()
    expect(root.scrollTop).toBe(600)
    windowEvents.get("pointerup")?.(new Event("pointerup"))
    root.scrollTop = root.scrollHeight - root.clientHeight - 40
    frame()
    frame()
    expect(follow.atBottom.value).toBe(true)
    expect(root.scrollTop).toBe(800)
  })

  it("失败路径：滚动条外的指针按下不脱底", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    advance(80)
    follow.onPointerDown({ clientX: 100, button: 0 } as PointerEvent)
    expect(follow.atBottom.value).toBe(true)
    root.scrollTop -= 60
    expect(follow.atBottom.value).toBe(true)
  })

  it("失败路径：滚轮上滚立即脱底并停掉自动贴底", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    follow.onWheel({
      deltaY: -120,
      target: null,
      preventDefault: () => {},
    } as unknown as WheelEvent)
    advance(8)
    expect(follow.atBottom.value).toBe(false)
    expect(root.scrollTop).toBe(480)
  })

  it("内容收缩的浏览器钳位不被误认为上翻", () => {
    const { root, follow } = fixture()

    follow.pinIfNeeded()
    advance(80)
    root.scrollHeight = 800
    root.scrollTop = root.scrollHeight - root.clientHeight
    expect(follow.atBottom.value).toBe(true)
    expect(root.scrollTop).toBe(400)
  })

  it("切换会话和卸载清理帧循环，不保留旧状态", () => {
    const { root, follow } = fixture()

    root.scrollHeight += 24
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)
    follow.reset()
    expect(frames.size).toBe(0)
    expect(follow.atBottom.value).toBe(false)
    follow.scrollToLatest()
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)
    lifecycle.unmount()
    expect(frames.size).toBe(0)
  })
})
