import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computed, nextTick, ref, shallowRef } from "vue"
import type {
  PiClient,
  RemoteSessionState,
  SessionSnapshot,
  TranscriptItem,
} from "@/types/common-type.js"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ContextUsageEstimate } from "@/types/context-usage-type.js"

const {
  openMock,
  createMock,
  makeSession,
  platformRequestMock,
  routeBox,
  routerPush,
  routerReplace,
} = vi.hoisted(() => {
  class FakeRemoteSession {
    id: string | undefined
    disposeCalls = 0
    subscribeCalls = 0
    listeners = new Set<(state: RemoteSessionState) => void>()
    state: RemoteSessionState = {
      lifecycle: { status: "ready" },
      transcript: [],
    }
    submit = vi.fn(async (_text: string) => undefined)
    abort = vi.fn(async () => undefined)
    setModel = vi.fn(async () => undefined)
    setThinking = vi.fn(async () => undefined)
    reconnect = vi.fn(async () => undefined)

    constructor(id?: string) {
      this.id = id
    }

    subscribe(listener: (state: RemoteSessionState) => void) {
      this.subscribeCalls += 1
      this.listeners.add(listener)
      listener(this.state)
      return () => this.listeners.delete(listener)
    }

    emit() {
      for (const listener of this.listeners) listener(this.state)
    }

    dispose() {
      this.disposeCalls += 1
      return Promise.resolve()
    }
  }
  return {
    openMock: vi.fn<(client: PiClient, sessionId: string) => Promise<FakeRemoteSession>>(),
    createMock: vi.fn<(client: PiClient, options: unknown) => Promise<FakeRemoteSession>>(),
    platformRequestMock: vi.fn(),
    routeBox: { params: { sessionId: undefined as string | undefined } },
    routerPush: vi.fn(),
    routerReplace: vi.fn(),
    makeSession: (id?: string) => new FakeRemoteSession(id),
  }
})

vi.mock("@earendil-works/pi-coding-agent/client", () => ({
  RemoteSession: class {
    static open = openMock
    static create = createMock
  },
}))

vi.mock("@client/http.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@client/http.js")>()
  return { ...actual, platformRequest: platformRequestMock }
})

vi.mock("vue-router", async () => {
  const { reactive } = await import("vue")
  routeBox.params = reactive({ sessionId: undefined as string | undefined })
  return {
    useRoute: () => ({ params: routeBox.params }),
    useRouter: () => ({ push: routerPush, replace: routerReplace }),
  }
})

import { useSessionLifecycle } from "@features/session-workbench/hooks/use-session.js"
import { useTurnFinish } from "@features/session-workbench/hooks/use-turn-finish.js"
import { useComposerQueue } from "@features/composer/hooks/use-composer-queue.js"
import { PlatformRequestError } from "@client/http.js"

type SessionLifecycle = ReturnType<typeof useSessionLifecycle>

let lifecycle: SessionLifecycle | undefined

afterEach(() => {
  lifecycle?.teardown()
  lifecycle = undefined
})

beforeEach(() => {
  openMock.mockReset()
  createMock.mockReset()
  platformRequestMock.mockReset()
  routerPush.mockReset()
  routerReplace.mockReset()
  routeBox.params.sessionId = undefined
  platformRequestMock.mockImplementation(async (path: string) => {
    if (path.includes("/transcript")) return { items: [] }

    if (path.includes("context-usage")) return { usage: usageEstimate }
    return {}
  })
  routerPush.mockImplementation(async (to: { params: { sessionId: string } }) => {
    routeBox.params.sessionId = to.params.sessionId
  })
  routerReplace.mockImplementation(async () => {
    routeBox.params.sessionId = undefined
  })
})

const usageEstimate: ContextUsageEstimate = {
  used: 300,
  window: 1000,
  segments: {
    systemPrompt: 50,
    memory: 25,
    skills: 0,
    tools: 75,
    toolResults: 0,
    conversation: 100,
    other: 50,
    idle: 700,
  },
}

function snapshot(revision: number): SessionSnapshot {
  return {
    id: "s1",
    cwd: "/repo",
    createdAt: 1,
    updatedAt: 1,
    phase: "idle",
    model: { provider: "test", id: "model" },
    thinkingLevel: "medium",
    attached: true,
    locked: false,
    revision,
    transcript: [],
    queuedSteer: [],
    queuedSteerCount: 0,
  }
}

const historyItem: TranscriptItem = {
  id: "u1",
  role: "user",
  content: [{ type: "text", text: "旧任务" }],
  timestamp: 1,
}

function setup(options?: {
  lastCwd?: string
  sessions?: { id: string; createdAt: number; cwd: string }[]
  connected?: { readonly value: boolean }
}) {
  const pi = {
    client: ref({} as unknown as PiClient),
    connected: computed(() => options?.connected?.value ?? true),
    connectionState: ref("connected"),
    connectionError: shallowRef<Error | undefined>(undefined),
    models: ref([]),
    sessions: ref(options?.sessions ?? []),
    bindAttachedReconnect: vi.fn(),
  }
  const cwd = {
    lastCwd: ref(options?.lastCwd ?? "/repo"),
    selectCwd: vi.fn(),
  }

  lifecycle?.teardown()

  const session = useSessionLifecycle(
    pi as unknown as ReturnType<typeof usePiClient>,
    cwd as unknown as ReturnType<typeof useLocalWorkspaces>,
  )

  lifecycle = session
  return { session, cwd }
}

function disconnectedError() {
  const error = new Error("disconnected")
  error.name = "PiDisconnectedError"
  return error
}

/** 等一个合帧周期（coalesceByFrame 的 8ms 兜底），让后台发布落地。 */
function nextFrame() {
  return new Promise((resolve) => setTimeout(resolve, 20))
}

describe("打开已有 Session", () => {
  it("从 Session 回到 / 时清空 Transcript", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [item] }
    openMock.mockResolvedValue(a)
    await session.initialize()
    routeBox.params.sessionId = "s1"
    await nextTick()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    routeBox.params.sessionId = undefined
    await nextTick()
    expect(session.transcript.value).toEqual([])
    expect(session.remote.value).toBeUndefined()
  })

  it("切回已缓存会话立刻露出历史，不等第二次 HTTP", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }
    let holdS1: Promise<void> = Promise.resolve()
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        if (path.includes("sessionId=s1")) await holdS1
        return path.includes("sessionId=s1")
          ? { items: [item], timings: [] }
          : { items: [], timings: [] }
      }

      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [item] }
    const b = makeSession("s2")
    b.state = { ...b.state, snapshot: { ...snapshot(1), id: "s2" } }
    openMock.mockImplementation(async (_client, id) => (id === "s1" ? a : b))
    await session.initialize()
    routeBox.params.sessionId = "s1"
    await nextTick()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(openMock).not.toHaveBeenCalled()
    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.transcript.value).toEqual([]))
    expect(session.remote.value).toBeUndefined()
    let releaseS1 = () => {}

    holdS1 = new Promise<void>((resolve) => {
      releaseS1 = resolve
    })
    routeBox.params.sessionId = "s1"
    await nextTick()
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"])
    releaseS1()
  })

  it("点开不打开会话、不回首页", async () => {
    const { session } = setup()
    openMock.mockRejectedValue(new Error("boom"))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await nextTick()
    expect(openMock).not.toHaveBeenCalled()
    expect(routerReplace).not.toHaveBeenCalled()
    expect(session.remote.value).toBeUndefined()
  })

  it("open 失败但历史已到：留在会话页", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    openMock.mockRejectedValue(new Error("boom"))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(routerReplace).not.toHaveBeenCalled()
    expect(session.remote.value).toBeUndefined()
  })

  it("历史未到时 cwd 用列表，不误用 lastCwd；发送后才用 snapshot", async () => {
    let releaseHistory = () => {}
    const historyGate = new Promise<void>((resolve) => {
      releaseHistory = resolve
    })

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        await historyGate
        return { items: [], timings: [] }
      }

      return { usage: usageEstimate }
    })

    const { session } = setup({
      lastCwd: "/wrong",
      sessions: [{ id: "s1", createdAt: 1, cwd: "/from-list" }],
    })
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), cwd: "/from-snap" } }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    const pending = session.initialize()
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(true))
    expect(session.sessionCwd.value).toBe("/from-list")
    expect(session.sessionCwd.value).not.toBe("/wrong")
    expect(openMock).not.toHaveBeenCalled()
    releaseHistory()
    await pending
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(false))
    expect(session.sessionCwd.value).toBe("/from-list")
    await session.sendPrompt("ping")
    await vi.waitFor(() => expect(session.sessionCwd.value).toBe("/from-snap"))
  })

  it("点开不投影运行态，历史未到时 cwd 用列表", async () => {
    let releaseHistory = () => {}

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        await new Promise<void>((resolve) => {
          releaseHistory = resolve
        })
        return { items: [historyItem], timings: [] }
      }

      return { usage: usageEstimate }
    })

    const { session } = setup({
      lastCwd: "/wrong",
      sessions: [{ id: "s2", createdAt: 2, cwd: "/b" }],
    })

    openMock.mockResolvedValue(makeSession("s2"))
    routeBox.params.sessionId = "s2"
    const pending = session.initialize()
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(true))
    expect(openMock).not.toHaveBeenCalled()
    expect(session.running.value).toBe(false)
    expect(session.sessionCwd.value).toBe("/b")
    expect(session.sessionCwd.value).not.toBe("/wrong")
    releaseHistory()
    await pending
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(false))
  })

  it("失败路径：发送时 open 遇 disconnected 且仍连接时再试一次", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    openMock.mockRejectedValueOnce(disconnectedError()).mockResolvedValueOnce(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    expect(openMock).not.toHaveBeenCalled()
    await session.sendPrompt("ping")
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    expect(openMock).toHaveBeenCalledTimes(2)
    expect(a.submit).toHaveBeenCalledWith("ping")
  })

  it("失败路径：点开不因重连而打开会话", async () => {
    const connected = ref(false)
    const { session } = setup({ connected })
    openMock.mockResolvedValue(makeSession("s1"))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    connected.value = true
    await nextTick()
    expect(openMock).not.toHaveBeenCalled()
    expect(session.remote.value).toBeUndefined()
  })

  it("失败路径：发送时两次 disconnected 则报错且不回首页", async () => {
    const { session } = setup()
    openMock.mockRejectedValue(disconnectedError())
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await expect(session.sendPrompt("ping")).rejects.toThrow()
    expect(routerReplace).not.toHaveBeenCalled()
    expect(openMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(openMock.mock.calls.length).toBeLessThan(8)
    expect(session.remote.value).toBeUndefined()
  })

  it("PiClient 未连接时 initialize 仍能拉到磁盘历史", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [] }
      return { usage: usageEstimate }
    })

    const pi = {
      client: ref(undefined as unknown as PiClient | undefined),
      connected: computed(() => false),
      connectionState: ref("idle"),
      connectionError: shallowRef<Error | undefined>(undefined),
      models: ref([]),
      sessions: ref([]),
      bindAttachedReconnect: vi.fn(),
    }
    const cwd = { lastCwd: ref("/repo"), selectCwd: vi.fn() }
    lifecycle?.teardown()

    const session = useSessionLifecycle(
      pi as unknown as ReturnType<typeof usePiClient>,
      cwd as unknown as ReturnType<typeof useLocalWorkspaces>,
    )

    lifecycle = session
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(openMock).not.toHaveBeenCalled()
  })

  it("已连接打开会话只拉一次历史", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(openMock).not.toHaveBeenCalled()
    expect(
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript")),
    ).toHaveLength(1)
  })

  it("未连接拉过历史，连上后不因 ready 再拉", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }
    const connected = ref(false)
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup({ connected })
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))

    const transcriptCalls = () =>
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript"))

    expect(transcriptCalls()).toHaveLength(1)
    connected.value = true
    await nextTick()
    expect(openMock).not.toHaveBeenCalled()
    expect(session.remote.value).toBeUndefined()
    expect(transcriptCalls()).toHaveLength(1)
  })
})

describe("快速切换 Session", () => {
  it("发送中切换会中止仍在 open 的会话，且不打开目标", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    let releaseA = () => {}
    let hitS1 = () => {}
    const enteredS1 = new Promise<void>((resolve) => {
      hitS1 = resolve
    })
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve
    })

    openMock.mockImplementation(async () => {
      hitS1()
      await gateA
      return a
    })
    routeBox.params.sessionId = "s1"
    await session.initialize()
    const sending = session.sendPrompt("ping")
    await enteredS1
    routeBox.params.sessionId = "s2"
    await nextTick()
    releaseA()
    await sending
    expect(session.remote.value).toBeUndefined()
    expect(a.subscribeCalls).toBe(0)
    await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
    expect(openMock.mock.calls.map((call) => call[1])).toEqual(["s1"])
  })

  it("已过期的 open 失败不上抛、不挡后续查看", async () => {
    const { session } = setup()
    let releaseA = () => {}
    let hitS1 = () => {}
    const enteredS1 = new Promise<void>((resolve) => {
      hitS1 = resolve
    })
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve
    })

    openMock.mockImplementation(async () => {
      hitS1()
      await gateA
      throw new Error("boom")
    })
    routeBox.params.sessionId = "s1"
    await session.initialize()
    const sending = session.sendPrompt("ping")
    await enteredS1
    routeBox.params.sessionId = "s2"
    await nextTick()
    releaseA()
    await expect(sending).resolves.toBe(false)
    expect(session.remote.value).toBeUndefined()
    expect(session.sessionError.value).toBe("")
  })
})

describe("创建 Session 后提交第一条 Prompt", () => {
  it("创建成功后发送正文", async () => {
    const { session, cwd } = setup()
    const created = makeSession("s2")
    createMock.mockResolvedValue(created)
    await expect(session.sendPrompt("  任务  ", "/repo")).resolves.toBe(true)

    expect(createMock).toHaveBeenCalledWith(expect.anything(), { cwd: "/repo" })
    expect(created.submit).toHaveBeenCalledWith("任务")
    expect(session.sessionError.value).toBe("")
    expect(cwd.selectCwd).toHaveBeenCalledWith("/repo")
  })

  it("创建未完成时 transcript 已含乐观用户句", async () => {
    const { session } = setup()
    const created = makeSession("s2")
    let releaseCreate = () => {}
    let markCreateStarted = () => {}
    const createStarted = new Promise<void>((resolve) => {
      markCreateStarted = resolve
    })
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })

    createMock.mockImplementation(async () => {
      markCreateStarted()
      await createGate
      return created
    })
    session.prompt.value = "任务"
    const request = session.sendPrompt("任务", "/repo")
    await createStarted

    expect(session.prompt.value).toBe("")
    expect(session.sessionId.value).toBeUndefined()
    expect(session.turnPending.value).toBe(true)
    expect(session.transcript.value).toHaveLength(2)
    expect(session.transcript.value[0]).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "任务" }],
    })
    expect(session.transcript.value[1]).toMatchObject({
      role: "assistant",
      status: "streaming",
      content: [],
    })

    releaseCreate()
    await request
    expect(created.submit).toHaveBeenCalledWith("任务")
  })

  it("创建期间 Abort 不再提交", async () => {
    const { session } = setup()
    const created = makeSession("s2")
    let releaseCreate = () => {}
    let markCreateStarted = () => {}
    const createStarted = new Promise<void>((resolve) => {
      markCreateStarted = resolve
    })
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })

    createMock.mockImplementation(async () => {
      markCreateStarted()
      await createGate
      return created
    })
    const request = session.sendPrompt("任务", "/repo")
    await createStarted
    expect(session.turnPending.value).toBe(true)
    await session.abortSession()
    expect(session.turnPending.value).toBe(false)
    expect(session.transcript.value).toEqual([])
    releaseCreate()
    await request
    expect(created.submit).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it("失败路径：创建失败恢复草稿并清掉乐观句", async () => {
    const { session } = setup()
    createMock.mockRejectedValue(new Error("创建失败"))
    session.prompt.value = "任务"

    await expect(session.sendPrompt("任务", "/repo")).rejects.toThrow("创建失败")

    expect(session.transcript.value).toEqual([])
    expect(session.prompt.value).toBe("任务")
    expect(session.sessionId.value).toBeUndefined()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it("失败路径：创建期间切换会话时不抢回路由且不误发 Prompt", async () => {
    const { session } = setup()
    const created = makeSession("created")
    const selected = makeSession("selected")
    let releaseCreate = () => {}
    let markCreateStarted = () => {}
    const createStarted = new Promise<void>((resolve) => {
      markCreateStarted = resolve
    })
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve
    })

    createMock.mockImplementation(async () => {
      markCreateStarted()
      await createGate
      return created
    })
    openMock.mockResolvedValue(selected)
    await session.initialize()

    const request = session.sendPrompt("任务", "/repo")
    await createStarted
    routeBox.params.sessionId = "selected"
    await nextTick()
    releaseCreate()
    await request

    expect(routerPush).not.toHaveBeenCalled()
    expect(session.remote.value).toBeUndefined()
    expect(created.disposeCalls).toBe(1)
    expect(created.submit).not.toHaveBeenCalled()
    expect(selected.submit).not.toHaveBeenCalled()
    expect(openMock).not.toHaveBeenCalled()
  })
})

describe("提交失败恢复草稿", () => {
  it("提交时立即清空草稿并插入乐观用户句", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, transcript: [historyItem] }
    let resolveSubmit = () => {}
    const pending = new Promise<undefined>((resolve) => {
      resolveSubmit = () => resolve(undefined)
    })

    a.submit.mockImplementation(() => pending)
    openMock.mockResolvedValue(a)
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [historyItem], timings: [] }
      return { usage: usageEstimate }
    })
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    session.prompt.value = "  新任务  "

    const request = session.sendPrompt(session.prompt.value)

    expect(session.prompt.value).toBe("")
    expect(session.clientState.value.sends).toMatchObject([
      {
        item: { role: "user", content: [{ type: "text", text: "新任务" }] },
        knownItemIds: ["u1"],
      },
    ])
    await vi.waitFor(() => expect(a.submit).toHaveBeenCalledWith("新任务"))

    resolveSubmit()
    await request
    expect(session.clientState.value.sends).toHaveLength(1)
  })

  it("提交失败时恢复未被新输入覆盖的草稿", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.submit.mockRejectedValue(new Error("发送失败"))
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    session.prompt.value = "任务"

    await expect(session.sendPrompt("任务")).rejects.toThrow("发送失败")

    expect(session.prompt.value).toBe("任务")
    expect(session.clientState.value.sends).toEqual([])
  })
})

describe("HTTP 历史与 live Transcript 合并", () => {
  it("打开已有会话只拉最新一页，上翻再 prepend 更早", async () => {
    const older = {
      id: "u0",
      role: "user" as const,
      content: [{ type: "text" as const, text: "更早" }],
      timestamp: 1,
    }
    const latest = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "最近" }],
      timestamp: 2,
    }

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        if (path.includes("before=")) return { items: [older], hasMore: false, timings: [] }
        return { items: [latest], hasMore: true, timings: [] }
      }

      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(session.historyHasMore.value).toBe(true)
    await session.loadOlderHistory()
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u0", "u1"])
    expect(session.historyHasMore.value).toBe(false)
  })

  it("打开会话恢复 HTTP 历史和耗时，空 snapshot 不冲掉", async () => {
    const item = {
      id: "u1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }
    const timing = { userId: "u1", startedAt: 1000, endedAt: 66000, outcome: "complete" }
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: [item], timings: [timing] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(session.turnTimings.value).toEqual([timing])
    a.state = { ...a.state, snapshot: snapshot(2), transcript: [] }
    a.emit()
    await vi.waitFor(() =>
      expect(
        platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript")),
      ).not.toHaveLength(0),
    )
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"])
    expect(session.turnTimings.value).toEqual([timing])
  })

  it("Turn 结束后再拉一页历史，临时 id 换成磁盘 id", async () => {
    const live = {
      id: "m1",
      role: "user" as const,
      content: [{ type: "text" as const, text: "hi" }],
      timestamp: 1,
    }
    const disk = { ...live, id: "u1" }
    let persisted: (typeof disk)[] = []
    const transcriptCalls = () =>
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript"))

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: persisted, timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("ping")
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    a.state = { ...a.state, transcript: [live] }
    a.emit()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toContain("m1"))
    const beforeIdle = transcriptCalls().length
    persisted = [disk]
    a.state = { ...a.state, snapshot: { ...snapshot(2), phase: "idle" }, transcript: [live] }
    a.emit()
    await vi.waitFor(() => {
      const ids = session.transcript.value.map((row) => row.id)
      expect(ids).toContain("u1")
      expect(ids).not.toContain("m1")
    })
    expect(transcriptCalls().length).toBe(beforeIdle + 1)
  })

  it("同一会话第二轮吸收最新页，不丢掉第一轮、用户句不重复", async () => {
    const turn1: TranscriptItem[] = [
      { id: "u1", role: "user", content: [{ type: "text", text: "一" }], timestamp: 1 },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "text", text: "答" }],
        timestamp: 2,
      } as TranscriptItem,
    ]
    const u2: TranscriptItem = {
      id: "u2",
      role: "user",
      content: [{ type: "text", text: "二" }],
      timestamp: 3,
    }
    let latestPage = turn1

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        return { items: latestPage, hasMore: latestPage[0]?.id === "u2", timings: [] }
      }

      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() =>
      expect(session.transcript.value.map((row) => row.id)).toEqual(["u1", "a1"]),
    )
    await session.sendPrompt("ping")
    await vi.waitFor(() => expect(session.projection.value?.updatedAt).toBe(1))
    a.state = { ...a.state, transcript: [{ ...u2, id: "m2" }] }
    a.emit()
    latestPage = [u2]
    a.state = { ...a.state, snapshot: snapshot(2), transcript: [{ ...u2, id: "m2" }] }
    a.emit()
    await vi.waitFor(() => {
      const ids = session.transcript.value.map((row) => row.id)
      expect(ids).toEqual(expect.arrayContaining(["u1", "a1", "u2"]))
      expect(ids).not.toContain("m2")
    })
  })

  it("running 时切走再切回发送：旧连接的临时条目不重复", async () => {
    const assistant = (id: string, text: string) =>
      ({
        id,
        role: "assistant",
        content: [{ type: "text", text }],
        model: { provider: "test", id: "model" },
        timestamp: 2,
        status: "streaming",
      }) as TranscriptItem
    const user = (id: string, text: string): TranscriptItem => ({
      id,
      role: "user",
      content: [{ type: "text", text }],
      timestamp: 1,
    })
    let disk: TranscriptItem[] = []
    const texts = () =>
      session.transcript.value
        .filter((row) => row.id !== "pending-assistant")
        .map((row) => row.content.map((part) => ("text" in part ? part.text : "")).join(""))

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        return { items: path.includes("sessionId=s1") ? disk : [], timings: [] }
      }

      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    const a2 = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    a2.state = { ...a2.state, snapshot: snapshot(3) }
    openMock.mockResolvedValueOnce(a).mockResolvedValueOnce(a2)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("一")
    a.state = { ...a.state, transcript: [user("m1", "一"), assistant("m2", "答到一半")] }
    a.emit()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toContain("m2"))

    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.transcript.value).toEqual([]))
    // 切走期间第一轮落盘
    disk = [
      user("u1", "一"),
      { ...assistant("a1", "答完了"), status: "complete" } as TranscriptItem,
    ]
    routeBox.params.sessionId = "s1"
    await nextTick()
    await vi.waitFor(() => expect(texts()).toEqual(["一", "答完了"]))

    await session.sendPrompt("二")
    disk = [...disk, user("u2", "二")]
    a2.state = { ...a2.state, snapshot: snapshot(4), transcript: [user("m3", "二")] }
    a2.emit()
    await vi.waitFor(() => expect(texts()).toEqual(["一", "答完了", "二"]))
  })

  it("连续帧：空 snapshot 不清掉已有进度，后续工具只追加不回退", async () => {
    const descriptor = {
      id: "a1",
      role: "assistant",
      content: ["t1", "t2", "t3"].map((toolCallId) => ({
        type: "toolCall" as const,
        toolCallId,
        toolName: "read",
        input: { path: `${toolCallId}.ts` },
      })),
      model: { provider: "test", id: "model" },
      timestamp: 2,
      status: "streaming",
    } satisfies TranscriptItem
    const liveTool = (toolCallId: string) =>
      ({
        id: toolCallId,
        role: "tool",
        toolCallId,
        toolName: "read",
        input: { path: `${toolCallId}.ts` },
        content: [],
        timestamp: 3,
        status: "running",
        isError: false,
      }) satisfies TranscriptItem
    const { session } = setup()
    const remote = makeSession("s1")
    remote.state = { ...remote.state, transcript: [descriptor, liveTool("t1"), liveTool("t2")] }
    openMock.mockResolvedValue(remote)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("ping")
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(
        expect.arrayContaining(["a1", "t1", "t2"]),
      ),
    )
    remote.state = { ...remote.state, snapshot: snapshot(2), transcript: [] }
    remote.emit()
    expect(session.transcript.value.map((item) => item.id)).toEqual(
      expect.arrayContaining(["a1", "t1", "t2"]),
    )
    remote.state = { ...remote.state, transcript: [liveTool("t3")] }
    remote.emit()
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(
        expect.arrayContaining(["a1", "t1", "t2", "t3"]),
      ),
    )
  })

  it("同一帧：工具完成后紧跟空快照，完成态不被清掉", async () => {
    const descriptor = {
      id: "a1",
      role: "assistant",
      content: [
        { type: "toolCall" as const, toolCallId: "t1", toolName: "read", input: { path: "t1.ts" } },
      ],
      model: { provider: "test", id: "model" },
      timestamp: 2,
      status: "streaming",
    } satisfies TranscriptItem
    const tool = (status: "running" | "complete") =>
      ({
        id: "t1",
        role: "tool",
        toolCallId: "t1",
        toolName: "read",
        input: { path: "t1.ts" },
        content: status === "complete" ? [{ type: "text" as const, text: "out" }] : [],
        timestamp: 3,
        status,
        isError: false,
      }) satisfies TranscriptItem
    const { session } = setup()
    const remote = makeSession("s1")
    remote.state = { ...remote.state, transcript: [descriptor, tool("running")] }
    openMock.mockResolvedValue(remote)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("ping")
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(
        expect.arrayContaining(["a1", "t1"]),
      ),
    )

    // 同一帧里先到 item_finished，再到清空库内 progress 的空快照
    remote.state = { ...remote.state, transcript: [descriptor, tool("complete")] }
    remote.emit()
    remote.state = { ...remote.state, snapshot: snapshot(2), transcript: [] }
    remote.emit()

    await vi.waitFor(() =>
      expect(session.transcript.value.at(-1)).toMatchObject({ id: "t1", status: "complete" }),
    )
    expect(session.transcript.value.map((item) => item.id)).toEqual(
      expect.arrayContaining(["a1", "t1"]),
    )
  })
})

describe("后台订阅池", () => {
  it("运行中的会话切走再切回复用同一连接", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("一")
    await vi.waitFor(() => expect(session.running.value).toBe(true))

    routeBox.params.sessionId = "s2"
    await nextTick()
    expect(session.remote.value).toBeUndefined()
    expect(session.backgroundRunningIds.value.has("s1")).toBe(true)

    routeBox.params.sessionId = "s1"
    await nextTick()
    expect(session.remote.value).toBe(a)
    expect(session.running.value).toBe(true)
    expect(session.backgroundRunningIds.value.has("s1")).toBe(false)
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(a.disposeCalls).toBe(0)
  })

  it("后台会话的 live 条目切回后可见且不重复", async () => {
    const user = (id: string, text: string): TranscriptItem => ({
      id,
      role: "user",
      content: [{ type: "text", text }],
      timestamp: 1,
    })
    const assistant = (id: string, text: string): TranscriptItem => ({
      id,
      role: "assistant",
      content: [{ type: "text", text }],
      model: { provider: "test", id: "model" },
      timestamp: 2,
      status: "streaming",
    })
    const texts = () =>
      session.transcript.value
        .filter((row) => row.id !== "pending-assistant")
        .map((row) => row.content.map((part) => ("text" in part ? part.text : "")).join(""))
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("一")
    await vi.waitFor(() => expect(session.running.value).toBe(true))

    routeBox.params.sessionId = "s2"
    await nextTick()
    expect(session.backgroundRunningIds.value.has("s1")).toBe(true)

    a.state = {
      ...a.state,
      snapshot: { ...snapshot(2), phase: "turn" },
      transcript: [user("m1", "一"), assistant("m2", "答到一半")],
    }
    a.emit()
    await nextFrame()
    a.state = {
      ...a.state,
      snapshot: { ...snapshot(3), phase: "turn" },
      transcript: [user("m1", "一"), assistant("m2", "答到一半"), assistant("m3", "又一段")],
    }
    a.emit()
    await nextFrame()

    routeBox.params.sessionId = "s1"
    await nextTick()
    await vi.waitFor(() => expect(texts()).toEqual(["一", "答到一半", "又一段"]))
    expect(openMock).toHaveBeenCalledTimes(1)
  })

  it("后台会话变 idle 后放掉连接、作废临时条目并重拉历史", async () => {
    let disk: TranscriptItem[] = []
    const calls = () =>
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript"))
        .length

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript"))
        return { items: path.includes("sessionId=s1") ? disk : [], timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }
    createMock.mockResolvedValue(a)
    await session.initialize()
    await session.createSession("/repo")
    await nextTick()
    await vi.waitFor(() => expect(session.running.value).toBe(true))

    routeBox.params.sessionId = "s2"
    await nextTick()
    expect(session.backgroundRunningIds.value.has("s1")).toBe(true)

    // 后台还在跑，先落一条临时条目的 live 覆盖
    a.state = {
      ...a.state,
      snapshot: { ...snapshot(2), phase: "turn" },
      transcript: [
        { id: "m1", role: "user", content: [{ type: "text", text: "进行中" }], timestamp: 1 },
      ],
    }
    a.emit()
    await nextFrame()

    const before = calls()
    disk = [historyItem]
    a.state = { ...a.state, snapshot: { ...snapshot(3), phase: "idle" }, transcript: [] }
    a.emit()

    await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
    expect(session.backgroundRunningIds.value.has("s1")).toBe(false)
    expect(calls()).toBe(before + 1)

    routeBox.params.sessionId = "s1"
    await nextTick()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
    expect(session.remote.value).toBeUndefined()
    expect(openMock).not.toHaveBeenCalled()
  })

  it("空闲会话切走仍然放掉连接", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("一")
    await vi.waitFor(() => expect(session.remote.value).toBe(a))

    routeBox.params.sessionId = "s2"
    await nextTick()

    await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
    expect(session.backgroundRunningIds.value.has("s1")).toBe(false)
  })
})

describe("后台会话跑完的队列泵送", () => {
  const attachment = () => ({
    id: "a.png",
    name: "a.png",
    mimeType: "image/png",
    size: 4,
    url: "blob:a.png",
    file: new File([new Uint8Array(1)], "a.png", { type: "image/png" }),
  })
  const bodies = () => platformRequestMock.mock.calls.map((call) => String(call[1]?.body ?? ""))

  /** 按 index.vue 的接线把队列交给 lifecycle：真实走 sendBackgroundPrompt。 */
  function wirePump(session: SessionLifecycle) {
    const queue = useComposerQueue()
    const sound = { play: vi.fn() }
    const turnFinish = useTurnFinish({
      sessionId: () => session.sessionId.value,
      running: () => session.running.value,
      pending: () => session.turnPending.value,
      transcript: () => session.transcript.value,
      queue,
      sound,
      sendForeground: (text, batch) => session.sendPrompt(text, undefined, batch),
      sendBackground: (id, text, batch) => session.sendBackgroundPrompt(id, text, batch),
      transcriptFor: (id) => session.transcriptFor(id),
    })

    session.setBackgroundIdleHandler(turnFinish.onBackgroundIdle)
    return { queue, sound, stop: turnFinish.stop }
  }

  async function runningInBackground(session: SessionLifecycle, a: ReturnType<typeof makeSession>) {
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("一")
    await vi.waitFor(() => expect(session.running.value).toBe(true))
    routeBox.params.sessionId = "s2"
    await nextTick()
    expect(session.backgroundRunningIds.value.has("s1")).toBe(true)
  }

  it("后台 idle 且队列有货：直接发出并留在池里，队列空后才出池响完成音", async () => {
    const { session } = setup()
    const { queue, sound, stop } = wirePump(session)

    try {
      const a = makeSession("s1")
      a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }

      await runningInBackground(session, a)
      queue.setKey("s1")
      queue.enqueue("第二条")
      queue.setKey("s2")

      // 真实 submit 等整轮才回：这一轮先在后台顶回 running，泵队停下来等下一次 idle
      a.submit.mockImplementation(async () => {
        a.state = { ...a.state, snapshot: { ...snapshot(2), phase: "turn" } }
        a.emit()
        await nextFrame()
      })

      a.state = { ...a.state, snapshot: { ...snapshot(3), phase: "idle" } }
      a.emit()
      await vi.waitFor(() => expect(a.submit).toHaveBeenCalledTimes(2))
      expect(a.submit).toHaveBeenLastCalledWith("第二条")
      expect(queue.sizeFor("s1")).toBe(0)
      expect(a.disposeCalls).toBe(0)
      expect(sound.play).not.toHaveBeenCalled()

      a.state = {
        ...a.state,
        snapshot: { ...snapshot(4), phase: "idle" },
        transcript: [
          {
            id: "m2",
            role: "assistant",
            content: [{ type: "text", text: "好了" }],
            model: { provider: "test", id: "model" },
            timestamp: 3,
            status: "complete",
            stopReason: "stop",
          },
        ],
      }
      a.emit()

      await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
      await vi.waitFor(() => expect(sound.play).toHaveBeenCalledWith("done"))
      expect(session.backgroundRunningIds.value.has("s1")).toBe(false)
    } finally {
      stop()
    }
  })

  it("submit 要等整轮才 resolve：期间的 idle 快照不丢，接着泵下一条直到出池", async () => {
    const { session } = setup()
    const { queue, sound, stop } = wirePump(session)

    try {
      const a = makeSession("s1")
      a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }

      await runningInBackground(session, a)
      queue.setKey("s1")
      queue.enqueue("第一条")
      queue.enqueue("第二条")
      queue.setKey("s2")

      let revision = 1

      // 真实 submit 等整轮才回：先广播 turn、再广播 idle（会被 idlePending 丢掉），最后才 resolve
      a.submit.mockImplementation(async () => {
        a.state = { ...a.state, snapshot: { ...snapshot((revision += 1)), phase: "turn" } }
        a.emit()
        await nextFrame()
        a.state = { ...a.state, snapshot: { ...snapshot((revision += 1)), phase: "idle" } }
        a.emit()
        await nextFrame()
      })

      a.state = { ...a.state, snapshot: { ...snapshot((revision += 1)), phase: "idle" } }
      a.emit()

      await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
      expect(a.submit.mock.calls.map((call) => call[0])).toEqual(["一", "第一条", "第二条"])
      expect(queue.sizeFor("s1")).toBe(0)
      expect(sound.play).toHaveBeenCalledWith("done")
      expect(sound.play).toHaveBeenCalledTimes(1)
    } finally {
      stop()
    }
  })

  it("后台发送的附件 stage 与 bind 都绑到后台会话 id", async () => {
    const { session } = setup()
    const { queue, stop } = wirePump(session)

    try {
      const a = makeSession("s1")
      a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }

      await runningInBackground(session, a)
      queue.setKey("s1")
      queue.enqueue("带附件", { batch: "batch-9", files: [attachment()] })
      queue.setKey("s2")

      a.state = { ...a.state, snapshot: { ...snapshot(2), phase: "idle" } }
      a.emit()
      await vi.waitFor(() => expect(a.submit).toHaveBeenCalledTimes(2))

      const staged = bodies().filter((body) => body.includes("batch-9"))

      expect(staged.length).toBeGreaterThan(0)
      expect(bodies().some((body) => body.includes('"sessionId":"s1"'))).toBe(true)
      expect(bodies().some((body) => body.includes('"sessionId":"s2"'))).toBe(false)
    } finally {
      stop()
    }
  })

  it("失败路径：后台发送失败把条目放回队首、停止泵队并出池", async () => {
    const { session } = setup()
    const { queue, sound, stop } = wirePump(session)

    try {
      const a = makeSession("s1")
      a.state = { ...a.state, snapshot: { ...snapshot(1), phase: "turn" } }

      await runningInBackground(session, a)
      a.submit.mockRejectedValueOnce(new Error("boom"))
      queue.setKey("s1")
      queue.enqueue("第二条")
      queue.enqueue("第三条")
      queue.setKey("s2")

      a.state = { ...a.state, snapshot: { ...snapshot(2), phase: "idle" } }
      a.emit()

      await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
      expect(queue.sizeFor("s1")).toBe(2)
      expect(a.submit).toHaveBeenCalledTimes(2)
      expect(sound.play).not.toHaveBeenCalledWith("done")
    } finally {
      stop()
    }
  })
})

describe("一轮工作", () => {
  it("已有复杂 Transcript 时提交：乐观用户句追加在历史后", async () => {
    const history: TranscriptItem[] = [
      {
        id: "u1",
        role: "user",
        content: [{ type: "text", text: "看表" }],
        timestamp: 1,
      },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "text", text: "| a | b |\n| --- | --- |\n$$E = mc^2$$" }],
        model: { provider: "test", id: "model" },
        timestamp: 2,
        status: "complete",
        stopReason: "stop",
      },
      {
        id: "t1",
        role: "tool",
        toolCallId: "t1",
        toolName: "read",
        input: { path: "a.ts" },
        content: [{ type: "text", text: "out" }],
        timestamp: 3,
        status: "complete",
        isError: false,
      },
    ]

    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) return { items: history, timings: [] }
      return { usage: usageEstimate }
    })
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1), transcript: [] }
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() =>
      expect(session.transcript.value.map((row) => row.id)).toEqual(["u1", "a1", "t1"]),
    )

    const request = session.sendPrompt("继续")
    expect(session.transcript.value.map((row) => row.role)).toEqual([
      "user",
      "assistant",
      "tool",
      "user",
      "assistant",
    ])
    expect(session.transcript.value.at(-2)).toMatchObject({
      role: "user",
      content: [{ type: "text", text: "继续" }],
    })
    await request
    expect(a.submit).toHaveBeenCalledWith("继续")
  })

  it("失败路径：Abort 调用 remote.abort", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.sendPrompt("ping")
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    await session.abortSession()
    expect(a.abort).toHaveBeenCalledTimes(1)
  })
})

describe("附件随发送", () => {
  function attachment(name: string, mimeType: string) {
    return {
      id: name,
      name,
      mimeType,
      size: 4,
      url: mimeType.startsWith("image/") ? `blob:${name}` : "",
      file: new File([new Uint8Array(1)], name, { type: mimeType }),
    }
  }

  const batch = {
    batch: "batch-1",
    files: [attachment("a.png", "image/png"), attachment("b.md", "text/markdown")],
  }
  const calls = () => platformRequestMock.mock.calls.map((call) => String(call[0]))

  it("先逐个 stage 再 bind，最后提交正文，成功不丢弃批次", async () => {
    const { session } = setup()
    const created = makeSession("s2")

    createMock.mockResolvedValue(created)
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/attachments/stage")) return { id: "staged" }
      return {}
    })

    await expect(session.sendPrompt("任务", "/repo", batch)).resolves.toBe(true)

    const staged = calls().filter((path) => path.includes("/attachments/stage"))

    expect(staged).toHaveLength(2)
    expect(staged[0]).toContain("batch=batch-1")
    expect(staged[0]).toContain("name=a.png")
    expect(staged[1]).toContain("mimeType=text%2Fmarkdown")
    expect(calls().findIndex((path) => path.includes("/attachments/bind"))).toBeGreaterThan(
      calls().findIndex((path) => path.includes("/attachments/stage")),
    )
    expect(created.submit).toHaveBeenCalledWith("任务")
    expect(session.sessionError.value).toBe("")
    expect(calls().some((path) => path.includes("/attachments/discard"))).toBe(false)
  })

  it("失败路径：bind 失败回填草稿、丢弃批次且不提交", async () => {
    const { session } = setup()
    const created = makeSession("s2")

    createMock.mockResolvedValue(created)
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/attachments/stage")) return { id: "staged" }

      if (path.includes("/attachments/bind"))
        throw new PlatformRequestError("BATCH_NOT_FOUND", "r1")
      return {}
    })

    await expect(session.sendPrompt("任务", "/repo", batch)).rejects.toThrow()

    expect(created.submit).not.toHaveBeenCalled()
    expect(session.prompt.value).toBe("任务")
    expect(session.sessionError.value).not.toBe("")
    expect(calls().some((path) => path.includes("/attachments/discard"))).toBe(true)
  })

  it("stage 中途被中止：不再 bind，丢弃批次并返回 false", async () => {
    const { session } = setup()
    const created = makeSession("s2")
    let releaseStage = () => {}
    let markStageStarted = () => {}
    const stageStarted = new Promise<void>((resolve) => {
      markStageStarted = resolve
    })
    const stageGate = new Promise<void>((resolve) => {
      releaseStage = resolve
    })

    createMock.mockResolvedValue(created)
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/attachments/stage")) {
        markStageStarted()
        await stageGate
        return { id: "staged" }
      }

      return {}
    })

    const request = session.sendPrompt("任务", "/repo", batch)

    await stageStarted
    await session.abortSession()
    releaseStage()
    await expect(request).resolves.toBe(false)

    // 只 stage 了第一个文件，没 bind，批次被丢弃
    expect(calls().filter((path) => path.includes("/attachments/stage"))).toHaveLength(1)
    expect(calls().some((path) => path.includes("/attachments/bind"))).toBe(false)
    expect(calls().some((path) => path.includes("/attachments/discard"))).toBe(true)
  })
})
