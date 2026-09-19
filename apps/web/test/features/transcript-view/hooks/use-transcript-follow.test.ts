import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"

const lifecycle = vi.hoisted(() => ({ unmount: () => {} }))

vi.mock("vue", async (original) => ({
  ...(await original<typeof import("vue")>()),
  onBeforeUnmount: (callback: () => void) => {
    lifecycle.unmount = callback
  },
}))

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
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) })
})

afterEach(() => {
  lifecycle.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("一轮工作：流式视口跟随", () => {
  it("底锚时增高不写 scrollTop", () => {
    const { root, follow } = fixture()
    expect(root.scrollTop).toBe(0)
    root.scrollHeight += 24
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(0)
    expect(follow.atBottom.value).toBe(true)
  })

  it("失败路径：用户上翻后不再抢滚动，显式回到底部才恢复", () => {
    const { root, follow } = fixture()
    root.scrollTop = 80
    follow.onScroll()
    expect(follow.atBottom.value).toBe(false)
    root.scrollHeight += 24
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(80)
    follow.scrollToLatest()
    expect(root.scrollTop).toBe(0)
    expect(follow.atBottom.value).toBe(true)
  })

  it("切换会话 reset 后不再贴底，直到显式回到底部", () => {
    const { root, follow } = fixture()
    follow.reset()
    expect(follow.atBottom.value).toBe(false)
    root.scrollTop = 80
    follow.pinIfNeeded()
    expect(root.scrollTop).toBe(80)
    follow.scrollToLatest()
    expect(root.scrollTop).toBe(0)
    lifecycle.unmount()
  })
})
