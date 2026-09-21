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
    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
    let releaseS1 = () => {}

    holdS1 = new Promise<void>((resolve) => {
      releaseS1 = resolve
    })
    routeBox.params.sessionId = "s1"
    await nextTick()
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"])
    releaseS1()
  })

  it("open 失败且尚无历史：不附加、回到首页", async () => {
    const { session } = setup()
    openMock.mockRejectedValue(new Error("boom"))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/"))
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

  it("打开中 cwd 用列表或 snapshot，不误用 lastCwd", async () => {
    let releaseOpen = () => {}
    const opened = new Promise<void>((resolve) => {
      releaseOpen = resolve
    })
    const { session } = setup({
      lastCwd: "/wrong",
      sessions: [{ id: "s1", createdAt: 1, cwd: "/from-list" }],
    })
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), cwd: "/from-snap" } }
    openMock.mockImplementation(async () => {
      await opened
      return a
    })
    routeBox.params.sessionId = "s1"
    const pending = session.initialize()
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(true))
    expect(session.sessionCwd.value).toBe("/from-list")
    expect(session.sessionCwd.value).not.toBe("/wrong")
    releaseOpen()
    await pending
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    expect(session.projection.value?.cwd).toBe("/from-snap")
    expect(session.sessionCwd.value).toBe("/from-snap")
  })

  it("lease 已齐历史未到时仍投影 snapshot 壳层", async () => {
    let releaseHistory = () => {}
    let historyGate = Promise.resolve()
    platformRequestMock.mockImplementation(async (path: string) => {
      if (path.includes("/transcript")) {
        await historyGate
        return { items: [historyItem], timings: [] }
      }

      return { usage: usageEstimate }
    })

    const { session } = setup({
      lastCwd: "/wrong",
      sessions: [
        { id: "s1", createdAt: 1, cwd: "/a" },
        { id: "s2", createdAt: 2, cwd: "/b" },
      ],
    })
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: { ...snapshot(1), id: "s1", cwd: "/a" } }
    const b = makeSession("s2")
    b.state = {
      ...b.state,
      snapshot: { ...snapshot(1), id: "s2", cwd: "/b", phase: "turn" },
    }
    openMock.mockImplementation(async (_client, id) => (id === "s1" ? a : b))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    historyGate = new Promise<void>((resolve) => {
      releaseHistory = resolve
    })
    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
    expect(session.sessionPending.value).toBe(true)
    expect(session.projection.value?.cwd).toBe("/b")
    expect(session.sessionCwd.value).toBe("/b")
    expect(session.running.value).toBe(true)
    releaseHistory()
    await vi.waitFor(() => expect(session.sessionPending.value).toBe(false))
  })

  it("失败路径：open 遇 disconnected 且仍连接时再试一次", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    openMock.mockRejectedValueOnce(disconnectedError()).mockResolvedValueOnce(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    expect(openMock).toHaveBeenCalledTimes(2)
  })

  it("失败路径：disconnected 后等 pi.connected 再打开", async () => {
    const connected = ref(true)
    const { session } = setup({ connected })
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    let first = true
    openMock.mockImplementation(async () => {
      if (first) {
        first = false
        connected.value = false
        throw disconnectedError()
      }

      return a
    })
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(openMock).toHaveBeenCalledTimes(1))
    expect(session.remote.value).toBeUndefined()
    connected.value = true
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    expect(openMock).toHaveBeenCalledTimes(2)
  })

  it("失败路径：两次 disconnected 则报错回首页", async () => {
    const { session } = setup()
    openMock.mockRejectedValue(disconnectedError())
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(routerReplace).toHaveBeenCalledWith("/"))
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
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"])
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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
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
    expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"])

    const transcriptCalls = () =>
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("/transcript"))

    expect(transcriptCalls()).toHaveLength(1)
    connected.value = true
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    expect(transcriptCalls()).toHaveLength(1)
  })
})

describe("快速切换 Session", () => {
  it("切换时中止仍在 open 的会话，不等它结束就打开目标", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    const b = makeSession("s2")
    let releaseA = () => {}
    let hitS1 = () => {}
    const enteredS1 = new Promise<void>((resolve) => {
      hitS1 = resolve
    })
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve
    })

    openMock.mockImplementation(async (_client, id) => {
      if (id === "s1") {
        hitS1()
        await gateA
        return a
      }

      return b
    })
    routeBox.params.sessionId = "s1"
    const first = session.initialize()
    await enteredS1
    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
    expect(a.subscribeCalls).toBe(0)
    releaseA()
    await first
    await vi.waitFor(() => expect(a.disposeCalls).toBe(1))
    expect(openMock.mock.calls.map((call) => call[1])).toEqual(["s1", "s2"])
  })

  it("已过期的 open 失败不上抛、不挡后续", async () => {
    const { session } = setup()
    const b = makeSession("s2")
    let releaseA = () => {}
    let hitS1 = () => {}
    const enteredS1 = new Promise<void>((resolve) => {
      hitS1 = resolve
    })
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve
    })

    openMock.mockImplementation(async (_client, id) => {
      if (id === "s1") {
        hitS1()
        await gateA
        throw new Error("boom")
      }

      return b
    })
    routeBox.params.sessionId = "s1"
    const first = session.initialize()
    await enteredS1
    routeBox.params.sessionId = "s2"
    await nextTick()
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
    await expect(first).resolves.toBeUndefined()
    releaseA()
  })
})

describe("创建 Session 后提交第一条 Prompt", () => {
  it("创建成功后发送正文", async () => {
    const { session, cwd } = setup()
    const created = makeSession("s2")
    createMock.mockResolvedValue(created)
    await session.sendPrompt("  任务  ", "/repo")

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

  it("创建失败时不提交", async () => {
    const { session } = setup()
    const created = makeSession("s2")
    createMock.mockRejectedValue(new Error("创建失败"))
    created.submit.mockClear()

    await expect(session.sendPrompt("任务", "/repo")).rejects.toThrow("创建失败")

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(created.submit).not.toHaveBeenCalled()
    expect(openMock).not.toHaveBeenCalled()
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
    await vi.waitFor(() => expect(session.remote.value).toBe(selected))

    expect(routerPush).not.toHaveBeenCalled()
    expect(created.disposeCalls).toBe(1)
    expect(created.submit).not.toHaveBeenCalled()
    expect(selected.submit).not.toHaveBeenCalled()
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
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    session.prompt.value = "  新任务  "

    const request = session.sendPrompt(session.prompt.value)

    expect(session.prompt.value).toBe("")
    expect(session.clientState.value.sends).toMatchObject([
      {
        item: { role: "user", content: [{ type: "text", text: "新任务" }] },
        knownItemIds: ["u1"],
      },
    ])
    expect(a.submit).toHaveBeenCalledWith("新任务")

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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    a.state = { ...a.state, transcript: [live] }
    a.emit()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["m1"]))
    const beforeIdle = transcriptCalls().length
    persisted = [disk]
    a.state = { ...a.state, snapshot: { ...snapshot(2), phase: "idle" }, transcript: [live] }
    a.emit()
    await vi.waitFor(() => expect(session.transcript.value.map((row) => row.id)).toEqual(["u1"]))
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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    await vi.waitFor(() =>
      expect(session.transcript.value.map((row) => row.id)).toEqual(["u1", "a1"]),
    )
    a.state = { ...a.state, transcript: [{ ...u2, id: "m2" }] }
    a.emit()
    latestPage = [u2]
    a.state = { ...a.state, snapshot: snapshot(2), transcript: [{ ...u2, id: "m2" }] }
    a.emit()
    await vi.waitFor(() =>
      expect(session.transcript.value.map((row) => row.id)).toEqual(["u1", "a1", "u2"]),
    )
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
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2"]),
    )
    remote.state = { ...remote.state, snapshot: snapshot(2), transcript: [] }
    remote.emit()
    expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2"])
    remote.state = { ...remote.state, transcript: [liveTool("t3")] }
    remote.emit()
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2", "t3"]),
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
    await vi.waitFor(() =>
      expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1"]),
    )

    // 同一帧里先到 item_finished，再到清空库内 progress 的空快照
    remote.state = { ...remote.state, transcript: [descriptor, tool("complete")] }
    remote.emit()
    remote.state = { ...remote.state, snapshot: snapshot(2), transcript: [] }
    remote.emit()

    await vi.waitFor(() =>
      expect(session.transcript.value.at(-1)).toMatchObject({ id: "t1", status: "complete" }),
    )
    expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1"])
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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
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
    await vi.waitFor(() => expect(session.remote.value).toBe(a))
    await session.abortSession()
    expect(a.abort).toHaveBeenCalledTimes(1)
  })
})

describe("context-usage", () => {
  it("snapshot revision 变化时刷新占用估算", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.state = { ...a.state, snapshot: snapshot(1) }
    openMock.mockResolvedValue(a)

    routeBox.params.sessionId = "s1"
    await session.initialize()
    await vi.waitFor(() => expect(session.contextUsage.value?.used).toBe(300))
    expect(platformRequestMock).toHaveBeenCalledWith("/api/v1/platform/context-usage?sessionId=s1")

    const usageCalls = () =>
      platformRequestMock.mock.calls.filter((call) => String(call[0]).includes("context-usage"))

    expect(usageCalls()).toHaveLength(1)
    a.emit()
    expect(usageCalls()).toHaveLength(1)
    a.state = { ...a.state, snapshot: snapshot(2) }
    a.emit()
    await vi.waitFor(() => expect(usageCalls()).toHaveLength(2))
  })
})
