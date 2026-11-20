import type { AgentSessionEvent, SessionEntry } from "@earendil-works/pi-coding-agent"
import type {
  AssistantTranscriptItem,
  JsonValue,
  TranscriptItem,
  TranscriptProgress,
  ToolTranscriptItem,
} from "@pig/protocol"
import {
  sanitizeDetails,
  toAssistantItem,
  toJsonValue,
  toTaskItem,
  toToolItem,
  toUserItem,
} from "./item-convert.js"

type AgentMessage = Extract<SessionEntry, { type: "message" }>["message"]

type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>

type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>

type SessionMessage = Extract<
  AgentSessionEvent,
  { type: "message_start" | "message_update" | "message_end" }
>["message"]

/**
 * 协议投影：把 AgentSession 事件与 SessionManager 条目映射为官方
 * TranscriptProgress / TranscriptItem。
 *
 * id 约定：
 * - user/assistant 条目的快照 id 用会话条目 id；进度事件中的流式 id 用自增
 *   `m<N>`（消息条目在事件后才落盘，事件本身不带条目 id）。message_end 后
 *   服务端立即广播快照，客户端以快照重建投影，流式 id 不会残留。
 * - tool 条目统一用 toolCallId 作 id，保证 running 占位与完成条目在客户端合并。
 */
export class TranscriptProjection {
  private readonly toolCalls = new Map<string, JsonValue>()
  private streamingMessageId: string | undefined
  private streamingParts: string[] = []
  private nextMessageId = 0
  private cachedEntries: readonly SessionEntry[] = []
  private cachedTranscript: TranscriptItem[] = []

  progress(event: AgentSessionEvent): TranscriptProgress | undefined {
    switch (event.type) {
      case "message_start":
        return this.messageProgress(event.message, "started")
      case "message_update":
        return this.textDelta(event) ?? this.messageProgress(event.message, "updated")
      case "message_end":
        return this.messageProgress(event.message, "finished")
      case "tool_execution_start": {
        let input: JsonValue

        try {
          input = toJsonValue(event.args)
        } catch {
          return undefined // 非 JSON 参数（不应发生），跳过该条目
        }

        this.toolCalls.set(event.toolCallId, input)
        return {
          type: "item_started",
          item: {
            id: event.toolCallId,
            role: "tool",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input,
            content: [],
            timestamp: Date.now(),
            status: "running",
            isError: false,
          },
        }
      }

      case "tool_execution_update": {
        const input = this.toolCalls.get(event.toolCallId)
        const partial = event.partialResult as { content?: unknown; details?: unknown } | undefined

        if (input === undefined || !partial) return undefined
        const details = toDetails(partial.details)
        return {
          type: "item_updated",
          item: {
            id: event.toolCallId,
            role: "tool",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            input,
            content: toolText(partial.content),
            ...(details === undefined ? {} : { details }),
            timestamp: Date.now(),
            status: "running",
            isError: false,
          },
        }
      }

      default:
        return undefined
    }
  }

  transcript(entries: readonly SessionEntry[]): TranscriptItem[] {
    if (
      entries.length === this.cachedEntries.length &&
      entries.every((entry, index) => entry.id === this.cachedEntries[index]?.id)
    )
      return this.cachedTranscript

    const toolCalls = new Map<string, JsonValue>()
    const items: TranscriptItem[] = []

    for (const entry of entries) {
      if (entry.type === "custom_message") {
        const task = toTaskItem(entry.details, entry.id, Date.parse(entry.timestamp))

        if (task) items.push(task)
        continue
      }

      if (entry.type !== "message") continue
      const message = entry.message

      if (message.role === "user") {
        items.push(toUserItem(message, entry.id))
      } else if (message.role === "assistant") {
        this.indexToolCalls(message.content, toolCalls)
        items.push(toAssistantItem(message, entry.id))
      } else if (message.role === "toolResult") {
        const args = toolCalls.get(message.toolCallId)

        if (args === undefined) continue // 找不到对应调用，无法构造输入
        items.push(this.toolItem(message, args))
      }
    }

    this.cachedEntries = entries
    this.cachedTranscript = items
    return items
  }

  inFlight(message: unknown): AssistantTranscriptItem | undefined {
    const id = this.streamingMessageId
    const current = message as AgentMessage | undefined
    return id && current?.role === "assistant" ? toAssistantItem(current, id) : undefined
  }

  private textDelta(
    event: Extract<AgentSessionEvent, { type: "message_update" }>,
  ): TranscriptProgress | undefined {
    const update = event.assistantMessageEvent
    const id = this.streamingMessageId

    if (!id || (update.type !== "text_delta" && update.type !== "thinking_delta")) return undefined
    const kind = update.type === "text_delta" ? "text" : "thinking"

    if (this.streamingParts[update.contentIndex] !== kind) return undefined
    return {
      type: "assistant_delta",
      messageId: id,
      contentIndex: update.contentIndex,
      kind,
      delta: update.delta,
    }
  }

  private messageProgress(
    message: SessionMessage,
    stage: "started" | "updated" | "finished",
  ): TranscriptProgress | undefined {
    switch (message.role) {
      case "user":
        if (stage !== "started") return undefined
        return {
          type: "item_started",
          item: toUserItem(message, this.allocateId()),
        }
      case "assistant": {
        this.indexToolCalls(message.content, this.toolCalls)

        const id =
          stage === "started"
            ? (this.streamingMessageId = this.allocateId())
            : (this.streamingMessageId ?? this.allocateId())
        const item = toAssistantItem(message, id)

        this.streamingParts = item.content.map((part) => part.type)

        if (stage === "finished") {
          this.streamingMessageId = undefined
          this.streamingParts = []

          if ("stopReason" in item) return { type: "item_finished", item }
          return undefined
        }

        if (stage === "updated") return { type: "item_updated", item }
        return { type: "item_started", item }
      }

      case "toolResult": {
        if (stage !== "finished") return undefined
        const args = this.toolCalls.get(message.toolCallId)

        if (args === undefined) return undefined
        this.toolCalls.delete(message.toolCallId)
        const item = this.toolItem(message, args)
        return {
          type: "item_finished",
          item: item as Extract<ToolTranscriptItem, { status: "complete" | "error" }>,
        }
      }

      case "custom": {
        const item =
          stage === "finished"
            ? toTaskItem(message.details, this.allocateId(), message.timestamp)
            : undefined
        return item ? { type: "item_started", item } : undefined
      }

      default:
        return undefined // 其余自定义角色（bash/compaction 等）不进 transcript
    }
  }

  private toolItem(message: ToolResultMessage, args: JsonValue): ToolTranscriptItem {
    return toToolItem(
      message,
      { id: message.toolCallId, name: message.toolName, arguments: toolCallArguments(args) },
      message.toolCallId,
    )
  }

  private indexToolCalls(
    content: AssistantMessage["content"],
    index: Map<string, JsonValue>,
  ): void {
    for (const part of content) {
      if (part.type !== "toolCall") continue

      try {
        index.set(part.id, toJsonValue(part.arguments))
      } catch {}
    }
  }

  private allocateId(): string {
    this.nextMessageId += 1
    return `m${this.nextMessageId}`
  }
}

function toolCallArguments(value: JsonValue): { [key: string]: JsonValue } {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value
  return {}
}

const toDetails = (value: unknown) => (value === undefined ? undefined : sanitizeDetails(value))

function toolText(content: unknown): Array<{ type: "text"; text: string }> {
  if (!Array.isArray(content)) return []
  return content.flatMap((part: unknown) => {
    const block = part as { type?: unknown; text?: unknown }
    return block?.type === "text" && typeof block.text === "string"
      ? [{ type: "text" as const, text: block.text }]
      : []
  })
}
