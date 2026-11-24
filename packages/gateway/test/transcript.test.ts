import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptProgress } from "@pig/protocol"
import { describe, expect, it } from "vitest"
import type { SessionRuntimeEvent } from "../src/pi/runtime-types.js"
import { PiHostSession } from "../src/pi/session-runtime.js"
import { TranscriptProjection } from "../src/pi/transcript.js"

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
    } as AgentSessionEvent) as Extract<TranscriptProgress, { type: "assistant_delta" }>

    expect(update.messageId).toBe(start.item.id)

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

describe("同一分支上投影只在末尾追加", () => {
  it("每次落盘后的投影都以上一次投影为前缀，含工具与任务条目", () => {
    const manager = SessionManager.inMemory("/tmp")
    const task = (status: string) => ({
      id: "t1",
      kind: "agent",
      description: "扫一遍",
      status,
    })
    const steps = [
      () => manager.appendMessage({ role: "user", content: "开始", timestamp: 1000 }),
      () =>
        manager.appendMessage(
          assistantMessage({
            stopReason: "toolUse",
            content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { cmd: "ls" } }],
          }),
        ),
      () => manager.appendMessage(toolResultMessage()),
      () => manager.appendCustomMessageEntry("task", "已开始", true, task("running")),
      () => manager.appendMessage(assistantMessage({ stopReason: "stop" })),
      () => manager.appendCustomMessageEntry("task", "已完成", true, task("completed")),
      () => manager.appendMessage({ role: "user", content: "再来", timestamp: 3000 }),
    ]
    const live = new TranscriptProjection()
    const snapshots: string[][] = []

    for (const step of steps) {
      step()
      snapshots.push(live.transcript(manager.getBranch()).map((item) => JSON.stringify(item)))
    }

    const roles = live.transcript(manager.getBranch()).map((item) => item.role)
    expect(roles).toEqual(["user", "assistant", "tool", "task", "assistant", "task", "user"])
    snapshots.forEach((current, index) => {
      expect(current.slice(0, snapshots[index - 1]?.length ?? 0)).toEqual(
        snapshots[index - 1] ?? [],
      )
    })
  })
})

describe("流式输出只发新增文字", () => {
  const update = (partial: TestMessage, assistantMessageEvent: Record<string, unknown>) =>
    ({ type: "message_update", message: partial, assistantMessageEvent }) as AgentSessionEvent

  it("同一文本块的后续增量只带新增部分，换块时补发完整条目，结束发完整终态", () => {
    const projection = new TranscriptProjection()
    const empty = assistantMessage({ content: [] })
    const start = projection.progress({
      type: "message_start",
      message: empty,
    } as AgentSessionEvent)
    const id = (start as { item: { id: string } }).item.id
    const one = assistantMessage({ content: [{ type: "text", text: "" }] })
    const opened = projection.progress(
      update(one, { type: "text_start", contentIndex: 0, partial: one }),
    )

    expect(opened).toMatchObject({ type: "item_updated", item: { id } })

    const long = "很长的一段回答。".repeat(200)
    const grown = assistantMessage({ content: [{ type: "text", text: `${long}再多一句` }] })
    const delta = projection.progress(
      update(grown, { type: "text_delta", contentIndex: 0, delta: "再多一句", partial: grown }),
    )

    expect(delta).toEqual({
      type: "assistant_delta",
      messageId: id,
      contentIndex: 0,
      kind: "text",
      delta: "再多一句",
    })

    const two = assistantMessage({
      content: [
        { type: "text", text: "a" },
        { type: "thinking", thinking: "" },
      ],
    })
    const nextBlock = projection.progress(
      update(two, { type: "thinking_delta", contentIndex: 1, delta: "", partial: two }),
    )

    expect(nextBlock).toMatchObject({ type: "item_updated", item: { id } })

    const end = projection.progress({
      type: "message_end",
      message: assistantMessage({ stopReason: "stop", content: [{ type: "text", text: "a" }] }),
    } as AgentSessionEvent)

    expect(end).toMatchObject({ type: "item_finished", item: { id, status: "complete" } })
  })
})

describe("工具执行中的进度进时间线", () => {
  it("tool_execution_update 带的 details 作为运行中条目的更新发出", () => {
    const projection = new TranscriptProjection()
    projection.progress({
      type: "tool_execution_start",
      toolCallId: "call-sub",
      toolName: "subagent",
      args: { tasks: [] },
    } as AgentSessionEvent)

    const update = projection.progress({
      type: "tool_execution_update",
      toolCallId: "call-sub",
      toolName: "subagent",
      args: { tasks: [] },
      partialResult: {
        content: [{ type: "text", text: "1/2" }],
        details: { mode: "parallel", results: [{ agent: "scout", status: "running" }] },
      },
    } as AgentSessionEvent)

    expect(update).toMatchObject({
      type: "item_updated",
      item: {
        id: "call-sub",
        status: "running",
        details: { results: [{ agent: "scout", status: "running" }] },
      },
    })
  })
})

describe("回合进行中挂上会话", () => {
  it("快照带着正在生成的助手消息，之后的增量用同一个 id 接在后面", () => {
    const projection = new TranscriptProjection()
    projection.progress({
      type: "message_start",
      message: assistantMessage({ content: [] }),
    } as AgentSessionEvent)
    const partial = assistantMessage({ content: [{ type: "text", text: "已经说了一半" }] })
    projection.progress({
      type: "message_update",
      message: partial,
      assistantMessageEvent: { type: "text_start", contentIndex: 0, partial },
    } as AgentSessionEvent)

    const inFlight = projection.inFlight(partial)
    expect(inFlight).toMatchObject({ content: [{ type: "text", text: "已经说了一半" }] })

    const grown = assistantMessage({ content: [{ type: "text", text: "已经说了一半，接着说" }] })
    const delta = projection.progress({
      type: "message_update",
      message: grown,
      assistantMessageEvent: {
        type: "text_delta",
        contentIndex: 0,
        delta: "，接着说",
        partial: grown,
      },
    } as AgentSessionEvent)

    expect(delta).toMatchObject({ type: "assistant_delta", messageId: inFlight?.id })
  })
})

describe("会话里的非对话事件进时间线", () => {
  it("会话开头的设置和没变值的切换不算，真正的切换、压缩和可见的扩展消息按条目位置投影", () => {
    const manager = SessionManager.inMemory("/tmp")
    manager.appendModelChange("anthropic", "claude-sonnet-4-5")
    manager.appendThinkingLevelChange("high")
    manager.appendMessage({ role: "user", content: "开始", timestamp: 1000 })
    manager.appendModelChange("anthropic", "claude-sonnet-4-5")
    manager.appendModelChange("openai", "gpt-5")
    manager.appendThinkingLevelChange("low")
    const kept = manager.appendMessage({ role: "user", content: "继续", timestamp: 2000 })
    manager.appendCompaction("目标与进度", kept, 128_000)
    manager.appendCustomMessageEntry("review-bot", "发现 2 处空指针", true)
    manager.appendCustomMessageEntry("hidden-state", "内部状态", false)

    const items = new TranscriptProjection().transcript(manager.getBranch())

    expect(items.map((item) => (item.role === "system" ? item.event : item.role))).toEqual([
      "user",
      {
        kind: "model_change",
        model: { provider: "openai", id: "gpt-5" },
        previous: { provider: "anthropic", id: "claude-sonnet-4-5" },
      },
      {
        kind: "thinking_level_change",
        thinkingLevel: "low",
        previous: "high",
        model: { provider: "openai", id: "gpt-5" },
      },
      "user",
      { kind: "compaction", tokensBefore: 128_000, summary: "目标与进度" },
      {
        kind: "extension_message",
        customType: "review-bot",
        content: [{ type: "text", text: "发现 2 处空指针" }],
      },
    ])
  })
})

describe("PiHostSession: 实时条目替换为落盘 id", () => {
  it("message_end 后落盘助手消息，item_finished 带真实 entryId 与 replaces", async () => {
    const manager = SessionManager.inMemory("/tmp")
    const listeners = new Set<(event: AgentSessionEvent) => void>()
    const session = {
      sessionId: manager.getSessionId(),
      isIdle: true,
      isCompacting: false,
      retryAttempt: 0,
      isStreaming: false,
      model: { provider: "test-provider", id: "test-model" },
      thinkingLevel: "off",
      state: { streamingMessage: undefined },
      sessionManager: manager,
      extensionRunner: { hasHandlers: () => false },
      getSteeringMessages: () => [],
      subscribe: (listener: (event: AgentSessionEvent) => void) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
      dispose: () => {},
    } as unknown as AgentSession
    const host = new PiHostSession(session)
    const events: SessionRuntimeEvent[] = []
    const stop = host.subscribe((event) => events.push(event))
    const streaming = assistantMessage({ content: [{ type: "text", text: "" }] })
    const final = assistantMessage({
      stopReason: "stop",
      content: [{ type: "text", text: "完整回复" }],
    })

    for (const listener of listeners)
      listener({ type: "message_start", message: streaming } as AgentSessionEvent)

    for (const listener of listeners)
      listener({ type: "message_end", message: final } as AgentSessionEvent)
    const entryId = manager.appendMessage(final)

    await Promise.resolve()

    const started = events.find(
      (event): event is Extract<SessionRuntimeEvent, { type: "progress" }> =>
        event.type === "progress" && event.progress.type === "item_started",
    )
    const finished = events.find(
      (event): event is Extract<SessionRuntimeEvent, { type: "progress" }> =>
        event.type === "progress" && event.progress.type === "item_finished",
    )

    expect(started?.progress.type).toBe("item_started")
    expect(finished?.progress).toMatchObject({
      type: "item_finished",
      replaces: "m1",
      item: { id: entryId, role: "assistant", status: "complete" },
    })
    expect(manager.getEntry(entryId)).toMatchObject({ type: "message", message: final })

    stop()
    await host.dispose()
  })
})
