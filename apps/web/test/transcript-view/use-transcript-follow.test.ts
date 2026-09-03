import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("vue", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue")>()
  return { ...actual, onBeforeUnmount: vi.fn() }
})

import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"

type FakeRoot = {
  clientHeight: number
  scrollHeight: number
  scrollTop: number
  readonly scrollWrites: number
}

const frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0

function createRoot(): FakeRoot & HTMLElement {
  let top = 100
  let writes = 0
  return {
    clientHeight: 500,
    scrollHeight: 600,
    get scrollTop() {
      return top
    },
    set scrollTop(value: number) {
      writes += 1
      top = value
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    get scrollWrites() {
      return writes
    },
  } as unknown as FakeRoot & HTMLElement
}

function flushFrame() {
  const pending = [...frames]
  frames.clear()
  for (const [id, callback] of pending) callback(id)
}

describe("useTranscriptFollow", () => {
  beforeEach(() => {
    nextFrame = 0
    frames.clear()
    vi.stubGlobal("window", {
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const id = ++nextFrame
        frames.set(id, callback)
        return id
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
      matchMedia: () => ({ matches: false }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("合并同一帧的多次贴底请求，只写入一次最新位置", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest()
    root.scrollHeight = 700
    follow.pinIfNeeded()
    follow.pinIfNeeded()
    follow.pinIfNeeded()

    expect(frames.size).toBe(1)
    expect(root.scrollTop).toBe(100)

    flushFrame()

    expect(root.scrollTop).toBe(200)
    expect(root.scrollWrites).toBe(1)
  })

  it("非贴底状态不排队滚动写入", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.pinIfNeeded()

    expect(frames.size).toBe(0)
    expect(root.scrollWrites).toBe(0)
  })

  it("释放跟随时取消待执行的贴底帧", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest()
    root.scrollHeight = 700
    follow.pinIfNeeded()
    expect(frames.size).toBe(1)

    follow.releasePinnedToBottom()
    flushFrame()

    expect(root.scrollTop).toBe(100)
    expect(root.scrollWrites).toBe(0)
  })

  it("贴底帧执行前再次确认未导航且仍贴底", () => {
    const target = { scrollIntoView: vi.fn() } as unknown as HTMLElement

    const navigatingRoot = createRoot()
    const navigating = useTranscriptFollow(() => navigatingRoot)
    navigating.scrollToLatest()
    navigatingRoot.scrollHeight = 700
    navigating.pinIfNeeded()
    const navigatingFrame = [...frames.values()][0]
    if (!navigatingFrame) throw new Error("expected a pending pin frame")
    navigating.scrollToElement(target)
    navigating.atBottom.value = true
    navigatingFrame(0)
    expect(navigatingRoot.scrollWrites).toBe(0)

    frames.clear()
    const leftBottomRoot = createRoot()
    const leftBottom = useTranscriptFollow(() => leftBottomRoot)
    leftBottom.scrollToLatest()
    leftBottomRoot.scrollHeight = 700
    leftBottom.pinIfNeeded()
    const leftBottomFrame = [...frames.values()][0]
    if (!leftBottomFrame) throw new Error("expected a pending pin frame")
    leftBottom.atBottom.value = false
    leftBottomFrame(0)
    expect(leftBottomRoot.scrollWrites).toBe(0)
  })
})
