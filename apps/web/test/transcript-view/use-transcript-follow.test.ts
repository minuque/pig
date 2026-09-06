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
  scrollTo: ReturnType<typeof vi.fn>
}

function createRoot(scrollTop = 100): FakeRoot & HTMLElement {
  let top = scrollTop
  let writes = 0
  const root = {
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
    scrollTo: vi.fn((opts: { top: number }) => {
      writes += 1
      top = opts.top
    }),
    get scrollWrites() {
      return writes
    },
  }
  return root as unknown as FakeRoot & HTMLElement
}

describe("useTranscriptFollow", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      setTimeout: () => 1,
      clearTimeout: vi.fn(),
      matchMedia: () => ({ matches: false }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("贴底时内容变高立刻写到最新底部", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest("auto")
    root.scrollHeight = 700
    follow.pinIfNeeded()
    follow.pinIfNeeded()

    expect(root.scrollTop).toBe(200)
  })

  it("非贴底状态不写入滚动位置", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.pinIfNeeded()

    expect(root.scrollWrites).toBe(0)
  })

  it("程序化贴底不进入平滑导航，后续增高仍能跟上", () => {
    const root = createRoot(0)
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest("auto")
    expect(root.scrollTo).not.toHaveBeenCalled()
    expect(root.scrollTop).toBe(100)

    root.scrollHeight = 800
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(300)
  })

  it("用户平滑回底部期间不贴底，结束后才跟上", () => {
    const root = createRoot(0)
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest("smooth")
    expect(root.scrollTo).toHaveBeenCalledWith({ top: 100, behavior: "smooth" })

    root.scrollHeight = 800
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(100)

    follow.releasePinnedToBottom()
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(300)
  })

  it("导航到元素期间不写入贴底位置", () => {
    const target = { scrollIntoView: vi.fn() } as unknown as HTMLElement
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest("auto")
    follow.scrollToElement(target)
    root.scrollHeight = 700
    follow.pinIfNeeded()

    expect(root.scrollTop).toBe(100)
  })

  it("离开底部后不写入贴底位置", () => {
    const root = createRoot()
    const follow = useTranscriptFollow(() => root)

    follow.scrollToLatest("auto")
    follow.atBottom.value = false
    root.scrollHeight = 700
    follow.pinIfNeeded()

    expect(root.scrollTop).toBe(100)
  })
})
