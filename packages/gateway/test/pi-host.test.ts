import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolve } from "node:path"
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptProgress } from "@earendil-works/pi-protocol"
import type { PiSessionRuntimeEvent } from "@earendil-works/pi-server"
import { afterEach, describe, expect, it } from "vitest"
import { canonicalizePath } from "../src/directory.js"
import { PiHostService } from "../src/pi/service.js"
import { PiHostSession } from "../src/pi/session-runtime.js"
import { TranscriptProjection } from "../src/pi/transcript.js"

const PROGRESS_WINDOW_MS = 16

// --- 测试替身 -------------------------------------------------------------

class FakeAgentSession {
  isStreaming = false
  isCompacting = false
  retryAttempt = 0
  sessionId = "session-1"
  sessionName: string | undefined
  model: { provider: string; id: string } = { provider: "test", id: "test-model" }
  thinkingLevel = "medium"
  steering: string[] = []
  prompts: string[] = []
  steers: string[] = []
  aborted = false
  disposed = false
  systemPrompt = "system prompt"
  cwd: string | undefined
  messages: Array<{ role: "user"; content: string; timestamp: number }> = []
  resourceLoader = {
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSkills: () => ({ skills: [] }),
  }
  private readonly listeners = new Set<(event: AgentSessionEvent) => void>()
  constructor(public sessionManager: SessionManager) {}

  get isIdle() {
    return !this.isStreaming
  }
  get modelRuntime() {
    return {
      getModel: (provider: string, id: string) =>
        provider === this.model.provider && id === this.model.id ? this.model : undefined,
    }
  }
  subscribe(listener: (event: AgentSessionEvent) => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  async prompt(text: string) {
    this.prompts.push(text)
  }
  async steer(text: string) {
    this.steers.push(text)
  }
  async abort() {
    this.aborted = true
  }
  async setModel(model: { provider: string; id: string }) {
    this.model = model
  }
  setThinkingLevel(level: string) {
    this.thinkingLevel = level
  }
  setSessionName(name: string) {
    this.sessionName = name
    this.sessionManager.appendSessionInfo(name)
    this.emit({ type: "session_info_changed", name })
  }
  getSteeringMessages() {
    return this.steering
  }
  getContextUsage() {
    return { tokens: 100, contextWindow: 1000, percent: 10 }
  }
  getActiveToolNames() {
    return []
  }
  getAllTools() {
    return []
  }
  async waitForIdle() {}
  dispose() {
    this.disposed = true
  }
  emit(event: AgentSessionEvent) {
    for (const listener of this.listeners) listener(event)
  }
}

const asSession = (fake: FakeAgentSession) => fake as unknown as AgentSession
const baseRuntime = {
  getModel: (provider: string, id: string) =>
    provider === "test" && id === "test-model" ? { provider, id } : undefined,
  getAvailable: async () => [
    {
      provider: "test",
      id: "test-model",
      name: "Test Model",
      api: "test",
      reasoning: false,
      input: ["text"],
      contextWindow: 1000,
      maxTokens: 1000,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    },
  ],
  hasConfiguredAuth: () => true,
}

type TestMessage = Parameters<SessionManager["appendMessage"]>[0]

const assistantMessage = (overrides: Record<string, unknown> = {}): TestMessage =>
  ({
    role: "assistant",
    content: [{ type: "text", text: "hello" }],
    api: "test",
    provider: "test-provider",
    model: "test-model",
    usage: {
      input: 1,
      output: 1,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 2,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "pending",
    timestamp: 1000,
    ...overrides,
  }) as TestMessage
const toolResultMessage = (overrides: Record<string, unknown> = {}): TestMessage =>
  ({
    role: "toolResult",
    toolCallId: "call-1",
    toolName: "bash",
    content: [{ type: "text", text: "out" }],
    isError: false,
    timestamp: 2000,
    ...overrides,
  }) as TestMessage

// --- TranscriptProjection --------------------------------------------------

describe("TranscriptProjection", () => {
  it("maps assistant message events to streaming progress with a stable id", () => {
    const projection = new TranscriptProjection()
    const start = projection.progress({
      type: "message_start",
      message: assistantMessage(),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_started" }>

    expect(start.type).toBe("item_started")
    expect(start.item).toMatchObject({ role: "assistant", status: "streaming" })

    const update = projection.progress({
      type: "message_update",
      message: assistantMessage(),
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "x",
        partial: assistantMessage(),
      },
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_updated" }>

    expect(update.item.id).toBe(start.item.id)

    const end = projection.progress({
      type: "message_end",
      message: assistantMessage({ stopReason: "stop", content: [{ type: "text", text: "hello" }] }),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_finished" }>

    expect(end.item).toMatchObject({ id: start.item.id, status: "complete", stopReason: "stop" })
  })

  it("maps tool execution start and tool result end to the same toolCallId", () => {
    const projection = new TranscriptProjection()
    const start = projection.progress({
      type: "tool_execution_start",
      toolCallId: "call-1",
      toolName: "bash",
      args: { cmd: "ls" },
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_started" }>

    expect(start.item).toMatchObject({ role: "tool", status: "running", toolCallId: "call-1" })

    const end = projection.progress({
      type: "message_end",
      message: toolResultMessage(),
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "item_finished" }>

    expect(end.item).toMatchObject({
      id: "call-1",
      role: "tool",
      status: "complete",
      isError: false,
    })
    expect(end.item).toHaveProperty("input", { cmd: "ls" })
  })

  it("历史条目保留 markdown / 表 / 公式 / Tool Call", () => {
    const manager = SessionManager.inMemory("/tmp")
    manager.appendMessage({ role: "user", content: "看表", timestamp: 1000 })
    manager.appendMessage(
      assistantMessage({
        stopReason: "toolUse",
        content: [
          {
            type: "text",
            text: "| a | b |\n| --- | --- |\n$$E = mc^2$$\n```mermaid\nflowchart LR\nA-->B\n```",
          },
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } },
        ],
        timestamp: 2000,
      }),
    )
    manager.appendMessage(toolResultMessage({ toolName: "read", timestamp: 3000 }))
    const items = new TranscriptProjection().transcript(manager.getBranch())
    expect(items.map((item) => item.role)).toEqual(["user", "assistant", "tool"])
    const assistant = items[1]
    expect(assistant?.role).toBe("assistant")

    if (assistant?.role !== "assistant") throw new Error("expected assistant")

    const text = assistant.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("")

    expect(text).toContain("| --- |")
    expect(text).toContain("$$E = mc^2$$")
    expect(text).toContain("```mermaid")
    expect(items[2]).toMatchObject({ role: "tool", toolCallId: "call-1", toolName: "read" })
  })
})

// --- PiHostSession ---------------------------------------------------------

describe("PiHostSession", () => {
  it("builds a snapshot and derives phase from agent state", () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asSession(fake))
    const snapshot = runtime.snapshot()
    expect(snapshot).toMatchObject({
      id: "session-1",
      cwd: canonicalizePath(resolve("/tmp")),
      phase: "idle",
      model: { provider: "test", id: "test-model" },
      thinkingLevel: "medium",
      revision: 0,
      transcript: [],
      queuedSteerCount: 0,
    })
    fake.isStreaming = true
    expect(runtime.getPhase()).toBe("turn")
  })

  it("forwards progress without an immediate stale snapshot", async () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asSession(fake))
    const events: { type: string }[] = []
    runtime.subscribe((event) => events.push(event))
    fake.emit({ type: "message_start", message: assistantMessage() } as AgentSessionEvent)
    fake.emit({ type: "turn_start" } as AgentSessionEvent)
    fake.emit({
      type: "message_update",
      message: assistantMessage(),
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "x",
        partial: assistantMessage(),
      },
    } as AgentSessionEvent)
    // message_start/message_update 只发 progress，不发 snapshot（旧快照会清掉流式 progress）；update 合流窗口内未发出
    expect(events.map((e) => e.type)).toEqual(["progress", "snapshot"])
    await new Promise((resolve) => setTimeout(resolve, PROGRESS_WINDOW_MS))
    expect(events.map((e) => e.type)).toEqual(["progress", "snapshot", "progress"])
    fake.emit({
      type: "message_end",
      message: assistantMessage({ stopReason: "stop", content: [{ type: "text", text: "hello" }] }),
    } as AgentSessionEvent)
    // item_finished 立即发出，未发送的 update 先冲刷；message_end 的 snapshot 延迟到持久化之后（queueMicrotask）
    expect(events.map((e) => e.type)).toEqual(["progress", "snapshot", "progress", "progress"])
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events.map((e) => e.type)).toEqual([
      "progress",
      "snapshot",
      "progress",
      "progress",
      "snapshot",
    ])
    expect(runtime.snapshot().revision).toBe(5)
  })

  it("连续 item_updated 合流只发最后一帧", async () => {
    const fake = new FakeAgentSession(SessionManager.inMemory("/tmp"))
    const runtime = new PiHostSession(asSession(fake))
    const events: PiSessionRuntimeEvent[] = []
    runtime.subscribe((event) => events.push(event))
    fake.emit({ type: "message_start", message: assistantMessage() } as AgentSessionEvent)

    for (let index = 0; index < 5; index += 1) {
      fake.emit({
        type: "message_update",
        message: assistantMessage(),
        assistantMessageEvent: {
          type: "text_delta",
          contentIndex: 0,
          delta: `d${index}`,
          partial: assistantMessage(),
        },
      } as AgentSessionEvent)
    }

    await new Promise((resolve) => setTimeout(resolve, PROGRESS_WINDOW_MS * 2))

    const updates = events.filter(
      (event) => event.type === "progress" && event.progress.type === "item_updated",
    )

    expect(updates).toHaveLength(1)
  })
})

// --- PiHostService ---------------------------------------------------------

describe("PiHostService", () => {
  const temps: string[] = []
  afterEach(async () => {
    await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })))
    temps.length = 0
  })

  const makeService = async (sessionDir?: string) => {
    const dir = sessionDir ?? (await mkdtemp(join(tmpdir(), "pig-pi-host-")))

    if (!sessionDir) temps.push(dir)
    const sessions = new Map<string, FakeAgentSession>()
    const service = new PiHostService({
      sessionDir: dir,
      cwd: dir,
      createRuntime: async () => baseRuntime as never,
      createSession: (async (options: {
        sessionManager: SessionManager
        model?: unknown
        cwd?: string
      }) => {
        const fake = new FakeAgentSession(options.sessionManager)
        fake.sessionId = options.sessionManager.getSessionId()
        fake.cwd = options.cwd

        if (options.model) fake.model = options.model as { provider: string; id: string }
        sessions.set(fake.sessionId, fake)
        return { session: fake as unknown as AgentSession }
      }) as never,
    })
    return { dir, service, sessions }
  }

  it("只读取当前已附加 session 的占用估算，并在释放后清理", async () => {
    const { service } = await makeService()
    const runtime = await service.createSession({ id: "sess-1" })
    expect(service.contextUsage("sess-1")).toMatchObject({
      used: 100,
      window: 1000,
      segments: { idle: 900 },
    })
    expect(service.contextUsage("missing")).toBeUndefined()
    await runtime.dispose()
    expect(service.contextUsage("sess-1")).toBeUndefined()
  })

  it("reopens a session in a fresh service and restores the transcript", async () => {
    // 进程重开：两个全新 PiHostService 共享 sessionDir，从磁盘恢复会话与 Transcript
    const dir = await mkdtemp(join(tmpdir(), "pig-pi-host-"))
    temps.push(dir)
    const first = await makeService(dir)
    const runtime = await first.service.createSession({ id: "sess-1" })
    const fake = first.sessions.get("sess-1")
    expect(fake).toBeDefined()
    const manager = fake!.sessionManager
    manager.appendMessage({ role: "user", content: "hi", timestamp: 1000 })
    manager.appendMessage(
      assistantMessage({
        stopReason: "toolUse",
        content: [
          { type: "text", text: "run" },
          { type: "toolCall", id: "call-1", name: "bash", arguments: { cmd: "ls" } },
        ],
        timestamp: 2000,
      }),
    )
    manager.appendMessage(toolResultMessage({ timestamp: 3000 }))
    expect(await first.service.listSessionCards()).toMatchObject([
      { id: "sess-1", messageCount: 3 },
    ])
    expect((await runtime.snapshot()).transcript).toEqual([])
    expect(
      (await first.service.sessionTranscript("sess-1")).items.map((item) => item.role),
    ).toEqual(["user", "assistant", "tool"])

    const second = await makeService(dir)
    const reopened = await second.service.openSession("sess-1")
    const snapshot = await reopened.snapshot()
    expect(snapshot).toMatchObject({ id: "sess-1" })
    expect(snapshot.transcript).toEqual([])
    const { items: history } = await second.service.sessionTranscript("sess-1")
    expect(history.map((item) => item.role)).toEqual(["user", "assistant", "tool"])
    expect(history[2]).toMatchObject({
      toolCallId: "call-1",
      input: { cmd: "ls" },
      status: "complete",
    })
  })

  it("长 transcript 走 sessionTranscript，snapshot 不带全文，卡片 messageCount 仍是全文", async () => {
    const { service, sessions } = await makeService()
    const runtime = await service.createSession({ id: "sess-long" })
    const manager = sessions.get("sess-long")!.sessionManager
    const total = 45

    for (let i = 0; i < total; i += 1) {
      manager.appendMessage({ role: "user", content: `m${i}`, timestamp: 1000 + i })
    }

    const snapshot = await runtime.snapshot()
    expect(snapshot.transcript).toEqual([])
    const first = await service.sessionTranscript("sess-long")
    expect(first.hasMore).toBe(true)
    expect(first.items.length).toBeGreaterThan(0)
    expect(first.items.length).toBeLessThan(total)
    expect(await service.listSessionCards()).toMatchObject([
      { id: "sess-long", messageCount: total },
    ])
  })

  it("打开会话与新建会话交出同一套规范化 cwd", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pig-pi-host-"))
    temps.push(dir)
    const { service, sessions } = await makeService(dir)
    // 会话文件里存原生拼写；两条路径都要交规范化拼写，SDK 的扩展缓存才不翻面
    SessionManager.create(dir, dir, { id: "sess-native" }).appendMessage(assistantMessage())
    await service.openSession("sess-native")
    await service.createSession({ id: "sess-new", cwd: dir })
    expect(sessions.get("sess-native")?.cwd).toBe(canonicalizePath(dir))
    expect(sessions.get("sess-new")?.cwd).toBe(canonicalizePath(dir))
  })

  it("renames via SessionManager and deletes the session file", async () => {
    const { service } = await makeService()
    const runtime = await service.createSession({ id: "sess-1" })
    await service.renameSession("sess-1", "卸载插件")
    expect((await runtime.snapshot()).name).toBe("卸载插件")
    expect(await service.listSessions()).toMatchObject([{ id: "sess-1", sessionName: "卸载插件" }])
    await service.deleteSession("sess-1")
    expect(await service.listSessions()).toEqual([])
  })

  it("rejects an unknown session and an unavailable model", async () => {
    const { service } = await makeService()
    await expect(service.openSession("missing")).rejects.toThrow(/not found/)
    await expect(
      service.createSession({ id: "sess-2", model: { provider: "test", id: "nope" } }),
    ).rejects.toThrow(/unavailable/)
    // 回滚：失败创建不遗留会话文件
    expect(await service.listSessions()).toHaveLength(0)
  })

  it("lists protocol model metadata", async () => {
    const { service } = await makeService()
    const models = await service.listModels()
    expect(models).toEqual([
      expect.objectContaining({ provider: "test", id: "test-model", authenticated: true }),
    ])
  })

  it("warm 预热会话列表和模型目录", async () => {
    const { service } = await makeService()
    await service.warm()
    expect(await service.listSessions()).toEqual([])
    expect(await service.listModels()).toEqual([
      expect.objectContaining({ provider: "test", id: "test-model" }),
    ])
  })
})
