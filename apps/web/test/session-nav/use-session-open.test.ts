import { describe, expect, it, vi } from "vitest"
import { nextTick, ref } from "vue"
import { useSessionOpen } from "@features/session-nav/hooks/use-session-open.js"

function setup(current?: string) {
  const sessionId = ref(current)
  const push = vi.fn()
  const open = useSessionOpen(sessionId, { push })

  return { sessionId, push, ...open }
}

describe("useSessionOpen", () => {
  it("点其他会话立刻改路由，高亮用正在打开的 id", () => {
    const nav = setup("a")
    nav.openSession("b")
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith({ name: "session", params: { sessionId: "b" } })
    expect(nav.highlightedSessionId.value).toBe("b")
  })

  it("路由落地后高亮跟 sessionId", async () => {
    const nav = setup("a")
    nav.openSession("b")
    nav.sessionId.value = "b"
    await nextTick()
    expect(nav.highlightedSessionId.value).toBe("b")
  })

  it("点当前已打开会话则取消未完成跳转", () => {
    const idle = setup("a")
    idle.openSession("a")
    expect(idle.push).not.toHaveBeenCalled()

    const nav = setup("a")
    nav.openSession("b")
    nav.push.mockClear()
    nav.openSession("a")
    expect(nav.push).toHaveBeenCalledTimes(1)
    expect(nav.push).toHaveBeenCalledWith({ name: "session", params: { sessionId: "a" } })
    expect(nav.highlightedSessionId.value).toBe("a")
  })
})
