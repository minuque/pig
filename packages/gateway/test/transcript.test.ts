import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptProgress } from "@pig/protocol"
import { describe, expect, it } from "vitest"
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
