import { computed, effectScope, shallowRef } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { SessionState } from "@client/gateway-session.js"

const opened: FakeSession[] = []

class FakeSession {
  listeners = new Set<(state: SessionState) => void>()
  submitted: string[] = []
  rejectSubmit = false
  constructor(readonly id: string) {}
  subscribe(listener: (state: SessionState) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  emit(state: SessionState) {
    for (const listener of this.listeners) listener(state)
  }
  async submit(text: string) {
    if (this.rejectSubmit) throw new Error("submit 被拒")
    this.submitted.push(text)
  }
  async dispose() {}
  async reattach() {}
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
  stageAttachment: vi.fn(async () => undefined),
  bindAttachments: vi.fn(async () => undefined),
  discardAttachments: vi.fn(async () => undefined),
}))

const { createSessionHub } = await import("@features/session/hooks/use-session-hub.js")
const { useForegroundSession } = await import("@features/session/hooks/use-foreground-session.js")
const { createBackgroundPump } = await import("@/shell/hooks/use-background-pump.js")
const { useComposerQueue } = await import("@features/composer/hooks/use-composer-queue.js")
const { createSharedBuckets } = await import("@features/composer/hooks/use-session-buckets.js")

function fakePi() {
  return {
    client: shallowRef({
      reconnect: vi.fn(async () => undefined),
      watchSession: vi.fn(async (_id: string) => undefined),
      unwatchSession: vi.fn(async (_id: string) => undefined),
      onSessionFileChanged: vi.fn((_id: string, _listener: () => void) => () => {}),
    }),
    connected: computed(() => true),
    bindAttachedReconnect: vi.fn(),
  }
}

const phase = (next: "running" | "idle", revision: number) =>
  ({ snapshot: { phase: next, revision, tasks: [] }, transcript: [] }) as unknown as SessionState
const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

function setup() {
  const scope = effectScope()
  const pi = fakePi()
  const sound = { play: vi.fn() }
  const announce = vi.fn()
  const buckets = createSharedBuckets()
  const { hub } = scope.run(() => {
    const hub = createSessionHub(pi as never)
    const pump = createBackgroundPump({
      queue: useComposerQueue(buckets),
      sound,
      send: hub.backgroundSend.send,
      transcriptFor: hub.history.transcriptFor,
      announce,
    })

    hub.setBackgroundIdle(pump.onIdle)
    return { hub }
  })!
  const paneQueue = useComposerQueue(buckets)
  const leftId = shallowRef<string>()
  const left = scope.run(() =>
    useForegroundSession(
      pi as never,
      computed(() => leftId.value),
      hub,
    ),
  )!

  async function background(id: string) {
    leftId.value = id
    left.showHistory(id)
    await left.ensureRemote(id)
    const session = opened.find((item) => item.id === id)!
    session.emit(phase("running", 1))
    await settle()
    left.leaveForeground()
    return session
  }

  return { scope, pi, hub, sound, announce, buckets, paneQueue, leftId, left, background }
}

afterEach(() => {
  opened.length = 0
})

describe("后台泵队挂在 Hub 上", () => {
  it("第二侧面板挂上又卸掉，后台会话空闲时队列照旧泵出且只泵一次", async () => {
    const ctx = setup()
    const a = await ctx.background("a")
    const rightScope = effectScope()
    const rightId = shallowRef<string>("b")
    const right = rightScope.run(() =>
      useForegroundSession(
        ctx.pi as never,
        computed(() => rightId.value),
        ctx.hub,
      ),
    )!

    right.showHistory("b")
    await right.ensureRemote("b")
    await right.dispose()
    rightScope.stop()

    ctx.paneQueue.setKey("a")
    ctx.paneQueue.enqueue("后台一条")
    a.emit(phase("idle", 2))
    await vi.waitFor(() => expect(a.submitted).toEqual(["后台一条"]))

    expect(ctx.paneQueue.items.value).toEqual([])
    expect(ctx.sound.play).toHaveBeenCalledTimes(1)
    ctx.scope.stop()
  })

  it("解绑后空闲不再泵队：队列留在原地", async () => {
    const ctx = setup()
    const a = await ctx.background("a")
    ctx.hub.setBackgroundIdle()
    ctx.paneQueue.setKey("a")
    ctx.paneQueue.enqueue("后台一条")

    a.emit(phase("idle", 2))
    await settle()

    expect(a.submitted).toEqual([])
    expect(ctx.paneQueue.sizeFor("a")).toBe(1)
    expect(ctx.sound.play).not.toHaveBeenCalled()
    ctx.scope.stop()
  })

  it("后台发送被拒：条目回队首，不响完成音", async () => {
    const ctx = setup()
    const a = await ctx.background("a")
    a.rejectSubmit = true
    ctx.paneQueue.setKey("a")
    ctx.paneQueue.enqueue("第一条")
    ctx.paneQueue.enqueue("第二条")

    a.emit(phase("idle", 2))
    await settle()

    expect(a.submitted).toEqual([])
    expect(ctx.paneQueue.sizeFor("a")).toBe(2)
    expect(ctx.sound.play).not.toHaveBeenCalled()
    expect(ctx.announce).not.toHaveBeenCalled()
    ctx.scope.stop()
  })

  it("队列空且干净收尾：响完成音并播报这个会话", async () => {
    const ctx = setup()
    const a = await ctx.background("a")

    a.emit(phase("idle", 2))
    await vi.waitFor(() => expect(ctx.sound.play).toHaveBeenCalledWith("done"))
    expect(ctx.announce).toHaveBeenCalledWith("a", "complete")
    expect(a.submitted).toEqual([])
    ctx.scope.stop()
  })
})
