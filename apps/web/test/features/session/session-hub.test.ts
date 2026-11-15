import { computed, effectScope, shallowRef } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types/common-type.js"

const opened: FakeSession[] = []

class FakeSession {
  listeners = new Set<(state: SessionState) => void>()
  constructor(readonly id: string) {}
  subscribe(listener: (state: SessionState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(state: SessionState) {
    for (const listener of this.listeners) listener(state)
  }
  async dispose() {}
  async reconnect() {}
}

vi.mock("@client/gateway-session.js", () => ({
  GatewaySession: {
    open: vi.fn(async (_client: unknown, id: string) => {
      const session = new FakeSession(id)
      opened.push(session)
      return session
    }),
  },
}))

vi.mock("@client/platform.js", () => ({
  sessionTranscript: vi.fn(async () => ({ items: [], timings: [], hasMore: false })),
  contextUsage: vi.fn(async () => null),
}))

const { createSessionHub } = await import("@features/session/hooks/use-session-hub.js")
const { useForegroundSession } = await import("@features/session/hooks/use-foreground-session.js")

function fakePi() {
  return {
    client: shallowRef({}),
    connected: computed(() => true),
    bindAttachedReconnect: vi.fn(),
  }
}

const running = (revision: number) =>
  ({
    snapshot: { phase: "running", revision, tasks: [] },
    transcript: [],
  }) as unknown as SessionState

afterEach(() => {
  opened.length = 0
})

describe("两侧共用会话后台池", () => {
  it("运行中的会话从左侧换到右侧：复用同一条连接，不重新打开", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const leftId = shallowRef<string>()
    const rightId = shallowRef<string>()
    const { left, right } = scope.run(() => {
      const hub = createSessionHub(pi as never)
      return {
        left: useForegroundSession(
          pi as never,
          computed(() => leftId.value),
          hub,
        ),
        right: useForegroundSession(
          pi as never,
          computed(() => rightId.value),
          hub,
        ),
      }
    })!

    leftId.value = "a"
    left.showHistory("a")
    await left.ensureRemote("a")
    expect(opened).toHaveLength(1)
    opened[0]!.emit(running(1))
    await new Promise((resolve) => setTimeout(resolve, 20))

    leftId.value = undefined
    left.leaveForeground()
    rightId.value = "a"
    right.showHistory("a")

    expect(right.remote.value).toBe(opened[0])
    expect(left.remote.value).toBeUndefined()
    expect(opened).toHaveLength(1)
    scope.stop()
  })

  it("两侧各挂一条前台连接，状态各写各的", async () => {
    const scope = effectScope()
    const pi = fakePi()
    const { left, right } = scope.run(() => {
      const hub = createSessionHub(pi as never)
      return {
        left: useForegroundSession(
          pi as never,
          computed(() => "a"),
          hub,
        ),
        right: useForegroundSession(
          pi as never,
          computed(() => "b"),
          hub,
        ),
      }
    })!

    left.showHistory("a")
    right.showHistory("b")
    await Promise.all([left.ensureRemote("a"), right.ensureRemote("b")])
    opened.find((session) => session.id === "b")!.emit(running(3))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(left.remote.value?.id).toBe("a")
    expect(right.remote.value?.id).toBe("b")
    expect(right.state.value?.snapshot?.revision).toBe(3)
    expect(left.state.value).toBeUndefined()
    scope.stop()
  })
})
