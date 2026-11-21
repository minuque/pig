import { describe, expect, it, vi } from "vitest"
import { effectScope, nextTick, ref } from "vue"
import { useTranscriptPosition } from "@features/transcript-view/hooks/use-transcript-position.js"

function setup(initialSession = "s1", initialReady = false) {
  const sessionId = ref(initialSession)
  const ready = ref(initialReady)
  let scrollTop = 0
  const restore = vi.fn((top: number) => {
    scrollTop = top
  })
  const pinLatest = vi.fn(() => {
    scrollTop = 1200
  })
  const onSessionChange = vi.fn()
  const scope = effectScope()

  scope.run(() => {
    useTranscriptPosition({
      sessionId: () => sessionId.value,
      ready: () => ready.value,
      readScrollTop: () => scrollTop,
      restore,
      pinLatest,
      onSessionChange,
    })
  })
  return {
    sessionId,
    ready,
    restore,
    pinLatest,
    onSessionChange,
    setScrollTop(top: number) {
      scrollTop = top
    },
    getScrollTop() {
      return scrollTop
    },
    stop() {
      scope.stop()
    },
  }
}

describe("useTranscriptPosition", () => {
  it("首次就绪贴底一次", async () => {
    const host = setup("s1", false)

    await nextTick()
    expect(host.pinLatest).not.toHaveBeenCalled()
    expect(host.restore).not.toHaveBeenCalled()

    host.ready.value = true
    await nextTick()
    expect(host.pinLatest).toHaveBeenCalledTimes(1)
    expect(host.restore).not.toHaveBeenCalled()
    expect(host.getScrollTop()).toBe(1200)
    host.stop()
  })

  it("缓存命中切回时精确恢复一次且不贴底", async () => {
    const host = setup("s1", true)

    await nextTick()
    expect(host.pinLatest).toHaveBeenCalledTimes(1)

    host.setScrollTop(600)
    host.sessionId.value = "s2"
    await nextTick()
    expect(host.onSessionChange).toHaveBeenCalledTimes(1)
    expect(host.pinLatest).toHaveBeenCalledTimes(2)

    host.sessionId.value = "s1"
    await nextTick()
    expect(host.restore).toHaveBeenCalledTimes(1)
    expect(host.restore).toHaveBeenCalledWith(600)
    expect(host.pinLatest).toHaveBeenCalledTimes(2)
    expect(host.getScrollTop()).toBe(600)
    host.stop()
  })

  it("切回时若历史异步到达，等就绪后恢复一次", async () => {
    const host = setup("s1", true)

    await nextTick()
    host.setScrollTop(420)
    host.sessionId.value = "s2"
    host.ready.value = false
    await nextTick()
    host.ready.value = true
    await nextTick()

    host.sessionId.value = "s1"
    host.ready.value = false
    await nextTick()
    host.setScrollTop(0)
    expect(host.restore).not.toHaveBeenCalled()
    expect(host.pinLatest).toHaveBeenCalledTimes(2)

    host.ready.value = true
    await nextTick()
    expect(host.restore).toHaveBeenCalledTimes(1)
    expect(host.restore).toHaveBeenCalledWith(420)
    expect(host.pinLatest).toHaveBeenCalledTimes(2)
    host.stop()
  })

  it("快切经过未加载完的会话时，不覆盖其已存位置", async () => {
    const host = setup("s1", true)

    await nextTick()
    host.setScrollTop(600)
    host.sessionId.value = "s2"
    await nextTick()
    host.setScrollTop(350)

    host.sessionId.value = "s1"
    await nextTick()
    host.sessionId.value = "s2"
    host.ready.value = false
    await nextTick()
    host.setScrollTop(0)

    host.sessionId.value = "s1"
    host.ready.value = true
    await nextTick()
    expect(host.restore).toHaveBeenCalledTimes(2)
    expect(host.restore).toHaveBeenLastCalledWith(600)

    host.sessionId.value = "s2"
    host.ready.value = true
    await nextTick()
    expect(host.restore).toHaveBeenCalledTimes(3)
    expect(host.restore).toHaveBeenLastCalledWith(350)
    host.stop()
  })
})
