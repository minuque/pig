import { computed, effectScope, shallowRef } from "vue"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GatewayRequestError } from "@client/gateway-client.js"

const opened: FakeSession[] = []
let rejectReattachOf: string | undefined

class FakeSession {
  constructor(readonly id: string) {}
  subscribe() {
    return () => {}
  }
  reattached = 0
  async dispose() {}
  async reattach() {
    if (this.id === rejectReattachOf) throw new GatewayRequestError("session_locked", "locked")
    this.reattached += 1
  }
}

const open = vi.fn(async (_client: unknown, id: string, _options?: { takeover?: boolean }) => {
  const session = new FakeSession(id)
  opened.push(session)
  return session
})

vi.mock("@client/gateway-session.js", () => ({ GatewaySession: { open } }))

const page = (externalTurn: boolean, version = "v1") => ({
  items: [],
  timings: [],
  hasMore: false,
  externalTurn,
  version,
})
const transcript = vi.fn(async (_id: string, cursor?: { known?: string }): Promise<unknown> => {
  return cursor?.known === "v1" ? { unchanged: true } : page(true)
})

vi.mock("@client/platform.js", () => ({
  sessionTranscript: transcript,
  contextUsage: vi.fn(async () => null),
}))

const { createSessionHub } = await import("@features/session/hooks/use-session-hub.js")
const { useForegroundSession } = await import("@features/session/hooks/use-foreground-session.js")
const { createHistoryStore } = await import("@features/session/hooks/use-session-history.js")
const online = shallowRef(true)
let reconnect: (() => Promise<void>) | undefined

function fakePi() {
  return {
    client: shallowRef({ reconnect: vi.fn(async () => undefined) }),
    connected: computed(() => online.value),
    bindAttachedReconnect: vi.fn((fn?: () => Promise<void>) => {
      reconnect = fn
    }),
  }
}

function side(pi: ReturnType<typeof fakePi>, hub: ReturnType<typeof createSessionHub>, id: string) {
  return useForegroundSession(
    pi as never,
    computed(() => id),
    hub,
  )
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  opened.length = 0
  rejectReattachOf = undefined
  online.value = true
  reconnect = undefined
  transcript.mockClear()
  open.mockClear()
})

describe("历史页：文件没变不重发", () => {
  it("收到 unchanged 时缓存原样不动，也不触发重算", async () => {
    const store = createHistoryStore()

    await store.loadHistory("a")
    const before = store.version.value

    store.overlayLive("a", [{ id: "x", role: "user", content: [], timestamp: 1 } as never])
    store.releaseLive("a")
    const staleBefore = store.version.value
    expect(store.isFresh("a")).toBe(false)

    await store.loadHistory("a", { force: true })

    expect(store.isFresh("a")).toBe(true)
    expect(store.version.value).toBe(staleBefore)
    expect(before).toBeLessThan(staleBefore)
    expect(transcript).toHaveBeenLastCalledWith("a", { known: "v1" })
    expect(store.externalTurnFor("a")).toBe(true)
  })
})

describe("外部回合只读", () => {
  it("断线期间轮询不发请求，恢复后继续", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    online.value = false
    await vi.advanceTimersByTimeAsync(0)
    transcript.mockClear()

    await vi.advanceTimersByTimeAsync(6000)
    expect(transcript).not.toHaveBeenCalled()

    online.value = true
    await vi.advanceTimersByTimeAsync(2000)
    expect(transcript).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it("上一次重拉还没回来时轮询不另发请求，慢响应照常落地", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    let land: (value: unknown) => void = () => {}

    transcript.mockImplementationOnce(() => new Promise((resolve) => (land = resolve)))
    transcript.mockClear()

    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    expect(transcript).toHaveBeenCalledTimes(1)

    land({ ...page(false, "v2"), items: [{ id: "n" }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(left.externalTurn.value).toBe(false)
    scope.stop()
  })

  it("externalTurn：缓存页带标记且这一侧没挂连接才为真，挂上后为假", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    expect(left.externalTurn.value).toBe(true)

    await left.takeover()

    expect(open).toHaveBeenCalledWith(expect.anything(), "a", { takeover: true })
    expect(left.externalTurn.value).toBe(false)
    scope.stop()
  })

  it("跟随刷新：未挂连接时每 2 秒重拉，挂上或卸下后停止", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    transcript.mockClear()

    await vi.advanceTimersByTimeAsync(4000)
    expect(transcript).toHaveBeenCalledTimes(2)

    await left.takeover()
    transcript.mockClear()
    await vi.advanceTimersByTimeAsync(6000)
    expect(transcript).not.toHaveBeenCalled()

    scope.stop()
  })

  it("一侧卸下后不再轮询", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    await left.dispose()
    transcript.mockClear()

    await vi.advanceTimersByTimeAsync(6000)
    expect(transcript).not.toHaveBeenCalled()
    scope.stop()
  })

  it("重连时一侧被 session_locked 拒绝：该侧放掉连接回到只读，另一侧照常重挂", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const { left, right } = scope.run(() => {
      const hub = createSessionHub(pi as never)
      return { left: side(pi, hub, "a"), right: side(pi, hub, "b") }
    })!

    left.showHistory("a")
    right.showHistory("b")
    await Promise.all([left.takeover(), right.ensureRemote("b")])
    rejectReattachOf = "a"
    transcript.mockClear()

    await reconnect!()
    await vi.advanceTimersByTimeAsync(0)

    expect(left.remote.value).toBeUndefined()
    expect(left.externalTurn.value).toBe(true)
    expect(transcript.mock.calls.some(([id]) => id === "a")).toBe(true)
    expect(right.remote.value?.id).toBe("b")
    expect(opened.find((session) => session.id === "b")!.reattached).toBe(1)
    scope.stop()
  })

  it("发送时挂载被 session_locked 拒绝：强制重拉历史并把错误交给发送路径", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const left = scope.run(() => side(pi, createSessionHub(pi as never), "a"))!

    left.showHistory("a")
    await vi.advanceTimersByTimeAsync(0)
    open.mockRejectedValueOnce(new GatewayRequestError("session_locked", "locked"))
    transcript.mockClear()

    await expect(left.ensureRemote("a")).rejects.toMatchObject({ code: "session_locked" })
    expect(transcript.mock.calls.some(([id]) => id === "a")).toBe(true)
    expect(left.remote.value).toBeUndefined()
    scope.stop()
  })
})
