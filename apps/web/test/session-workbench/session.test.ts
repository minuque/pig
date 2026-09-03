import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { computed, nextTick, ref, shallowRef } from "vue"
import type { PiClient } from "@earendil-works/pi-client"
import type { RemoteSessionState } from "@earendil-works/pi-coding-agent/client"
import type { SessionSnapshot, TranscriptItem } from "@earendil-works/pi-protocol"
import type { useLocalWorkspaces } from "@client/local-cwd.js"
import type { usePiClient } from "@client/pi-client.js"
import type { ContextUsageEstimate } from "@features/chat-input/lib/context-usage.js"

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

function setup() {
  const pi = {
    client: ref({} as unknown as PiClient),
    connected: computed(() => true),
    connectionState: ref("connected"),
    connectionError: shallowRef<Error | undefined>(undefined),
    models: ref([]),
    sessions: ref([]),
    bindAttachedReconnect: vi.fn(),
  }
  const cwd = {
    lastCwd: ref("/repo"),
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

describe("打开已有 Session", () => {
  it("openSession 幂等：已附加同 id 时跳过", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.initialize()
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(session.remote.value).toBe(a)
  })

  it("open 失败：不附加、回到首页", async () => {
    const { session } = setup()
    openMock.mockRejectedValue(new Error("boom"))
    routeBox.params.sessionId = "s1"
    await session.initialize()
    expect(session.remote.value).toBeUndefined()
    expect(routerReplace).toHaveBeenCalledWith("/")
  })
})

describe("快速切换 Session", () => {
  it("快速连点只打开最后一次请求的 session", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    const b = makeSession("s2")
    const c = makeSession("s3")
    openMock.mockImplementation(async (_client, id) => {
      if (id === "s1") return a
      if (id === "s2") return b
      return c
    })
    await session.initialize()
    routeBox.params.sessionId = "s1"
    routeBox.params.sessionId = "s2"
    routeBox.params.sessionId = "s3"
    await nextTick()
    await vi.waitFor(() => expect(session.remote.value).toBe(c))
    expect(openMock).toHaveBeenCalledTimes(1)
    expect(openMock.mock.calls[0]?.[1]).toBe("s3")
    expect(a.disposeCalls).toBe(0)
    expect(b.disposeCalls).toBe(0)
  })

  it("进行中的 open 完成后若已切走则释放、不附加", async () => {
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
    releaseA()
    await first
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
    expect(openMock.mock.calls.map((call) => call[1])).toEqual(["s1", "s2"])
    expect(a.disposeCalls).toBe(1)
    expect(a.subscribeCalls).toBe(0)
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
    releaseA()
    await expect(first).resolves.toBeUndefined()
    await vi.waitFor(() => expect(session.remote.value).toBe(b))
  })
})

describe("创建 Session 后提交第一条 Prompt", () => {
  it("createSession 替换已附加实例时释放旧 lease", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    const b = makeSession("s2")
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    createMock.mockResolvedValue(b)
    await session.createSession("/repo")
    expect(a.disposeCalls).toBe(1)
    expect(session.remote.value).toBe(b)
  })

  it("创建成功后发送正文", async () => {
    const { session, cwd } = setup()
    const created = makeSession("s2")
    createMock.mockResolvedValue(created)
    await session.createAndSubmit("/repo", "  任务  ")

    expect(createMock).toHaveBeenCalledWith(expect.anything(), { cwd: "/repo" })
    expect(created.submit).toHaveBeenCalledWith("任务")
    expect(session.sessionError.value).toBe("")
    expect(cwd.selectCwd).toHaveBeenCalledWith("/repo")
  })

  it("创建失败时不提交", async () => {
    const { session } = setup()
    const created = makeSession("s2")
    createMock.mockRejectedValue(new Error("创建失败"))
    created.submit.mockClear()

    await expect(session.createAndSubmit("/repo", "任务")).rejects.toThrow("创建失败")

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(created.submit).not.toHaveBeenCalled()
    expect(openMock).not.toHaveBeenCalled()
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

    const request = session.createAndSubmit("/repo", "任务")
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
    session.prompt.value = "  新任务  "

    const request = session.submitText(session.prompt.value)

    expect(session.prompt.value).toBe("")
    expect(session.clientState.value?.optimisticUser).toMatchObject({
      item: { role: "user", content: [{ type: "text", text: "新任务" }] },
      knownItemIds: ["u1"],
    })
    expect(a.submit).toHaveBeenCalledWith("新任务")

    resolveSubmit()
    await request
    expect(session.clientState.value?.optimisticUser).toBeNull()
  })

  it("空白正文不提交", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await session.submitText("   ")
    expect(a.submit).not.toHaveBeenCalled()
    expect(session.clientState.value?.optimisticUser).toBeNull()
  })

  it("提交失败时恢复未被新输入覆盖的草稿", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    a.submit.mockRejectedValue(new Error("发送失败"))
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    session.prompt.value = "任务"

    await expect(session.submitText("任务")).rejects.toThrow("发送失败")

    expect(session.prompt.value).toBe("任务")
    expect(session.clientState.value?.optimisticUser).toBeNull()
  })
})

describe("HTTP 历史与 live Transcript 合并", () => {
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

    expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2"])
    remote.state = { ...remote.state, snapshot: snapshot(2), transcript: [] }
    remote.emit()
    expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2"])
    remote.state = { ...remote.state, transcript: [liveTool("t3")] }
    remote.emit()
    expect(session.transcript.value.map((item) => item.id)).toEqual(["a1", "t1", "t2", "t3"])
  })
})

describe("dispose 与 context-usage", () => {
  it("dispose 可重复调用且底层只 dispose 一次", async () => {
    const { session } = setup()
    const a = makeSession("s1")
    openMock.mockResolvedValue(a)
    routeBox.params.sessionId = "s1"
    await session.initialize()
    await Promise.all([session.dispose(), session.dispose(), session.dispose()])
    expect(a.disposeCalls).toBe(1)
    expect(session.remote.value).toBeUndefined()
  })

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
