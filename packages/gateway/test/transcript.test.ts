import type { AgentSessionEvent } from "@earendil-works/pi-coding-agent"
import { SessionManager } from "@earendil-works/pi-coding-agent"
import type { TranscriptProgress } from "@earendil-works/pi-protocol"
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
