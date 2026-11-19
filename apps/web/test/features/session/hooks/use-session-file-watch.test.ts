import { nextTick, ref, shallowRef } from "vue"
import { describe, expect, it, vi } from "vitest"
import {
  useSessionFileWatch,
  type SessionFileWatchClient,
} from "@features/session/hooks/use-session-file-watch.js"

function fakeClient() {
  const listeners = new Map<string, Set<() => void>>()
  const watched: string[] = []
  const unwatched: string[] = []
  const client: SessionFileWatchClient & { emit(id: string): void } = {
    watchSession: (id) => {
      watched.push(id)
      return Promise.resolve()
    },
    unwatchSession: (id) => {
      unwatched.push(id)
      return Promise.resolve()
    },
    onSessionFileChanged: (id, listener) => {
      const set = listeners.get(id) ?? new Set()
      set.add(listener)
      listeners.set(id, set)
      return () => set.delete(listener)
    },
    emit: (id) => {
      for (const listener of listeners.get(id) ?? []) listener()
    },
  }
  return { client, watched, unwatched }
}

function setup(options: { sessionId?: string; connected?: boolean; pooled?: string[] } = {}) {
  const fake = fakeClient()
  const sessionId = ref<string | undefined>(options.sessionId ?? "s1")
  const attached = ref<string | undefined>()
  const connected = ref(options.connected ?? true)
  const pooled = new Set(options.pooled ?? [])
  const changes: string[] = []
  const watch = useSessionFileWatch({
    client: shallowRef(fake.client),
    connected,
    sessionId,
    attached,
    pooled: (id) => pooled.has(id),
    changed: (id) => changes.push(id),
  })
  return { ...fake, watch, sessionId, attached, connected, changes }
}

describe("按需 watch 会话文件", () => {
  it("显示中且没挂连接时订阅，并立刻补拉一次历史", async () => {
    const test = setup({ connected: false })

    await nextTick()
    expect(test.watched).toEqual([])

    test.connected.value = true
    await nextTick()
    expect(test.watched).toEqual(["s1"])
    expect(test.changes).toEqual(["s1"])
  })

  it("收到文件变化就重拉历史", async () => {
    const test = setup()

    await nextTick()
    test.client.emit("s1")
    expect(test.changes).toEqual(["s1", "s1"])
  })

  it("挂上连接、切走会话、断线都退订", async () => {
    const test = setup()

    await nextTick()
    expect(test.watched).toEqual(["s1"])

    test.attached.value = "s1"
    await nextTick()
    expect(test.unwatched).toEqual(["s1"])

    test.client.emit("s1")
    expect(test.changes).toEqual(["s1"])

    test.attached.value = undefined
    await nextTick()
    expect(test.watched).toEqual(["s1", "s1"])

    test.sessionId.value = "s2"
    await nextTick()
    expect(test.watched).toEqual(["s1", "s1", "s2"])
    expect(test.unwatched).toEqual(["s1", "s1"])

    test.connected.value = false
    await nextTick()
    expect(test.unwatched).toEqual(["s1", "s1", "s2"])
  })

  it("后台池里已有订阅就不再 watch", async () => {
    const test = setup({ pooled: ["s1"] })

    await nextTick()
    expect(test.watched).toEqual([])
    expect(test.changes).toEqual([])
  })

  it("stop 退订；期间没有文件事件就不重拉，不再靠定时轮询", async () => {
    vi.useFakeTimers()

    try {
      const test = setup()

      await nextTick()
      vi.advanceTimersByTime(10_000)
      await nextTick()
      expect(test.changes).toEqual(["s1"])

      test.watch.stop()
      expect(test.unwatched).toEqual(["s1"])
      test.client.emit("s1")
      expect(test.changes).toEqual(["s1"])
    } finally {
      vi.useRealTimers()
    }
  })
})
