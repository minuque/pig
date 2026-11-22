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
  toExtensionMessage,
  toJsonValue,
  toSystemItem,
  toTaskItem,
  toToolItem,
  toUserItem,
} from "./item-convert.js"

// 外部：pi-ai 未直接依赖，从官方会话类型提取
type AgentMessage = Extract<SessionEntry, { type: "message" }>["message"]

type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>

type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>

type SessionMessage = Extract<
  AgentSessionEvent,
  { type: "message_start" | "message_update" | "message_end" }
>["message"]

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
          return undefined
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
    const settings: { model?: string; thinking?: string } = {}

    for (const entry of entries) {
      if (entry.type === "custom_message") {
        const item =
          toTaskItem(entry.details, entry.id, Date.parse(entry.timestamp)) ?? toSystemItem(entry)

        if (item) items.push(item)
        continue
      }

      if (entry.type === "model_change" || entry.type === "thinking_level_change") {
        const key = entry.type === "model_change" ? "model" : "thinking"
        const value =
          entry.type === "model_change" ? `${entry.provider}/${entry.modelId}` : entry.thinkingLevel
        const previous = settings[key]
        settings[key] = value

        if (previous === undefined || previous === value) continue
      }

      if (entry.type !== "message") {
        const item = toSystemItem(entry)

        if (item) items.push(item)
        continue
      }

      const message = entry.message

      if (message.role === "user") {
        items.push(toUserItem(message, entry.id))
      } else if (message.role === "assistant") {
        settings.model = `${message.provider}/${message.model}`
        this.indexToolCalls(message.content, toolCalls)
        items.push(toAssistantItem(message, entry.id))
      } else if (message.role === "toolResult") {
        const args = toolCalls.get(message.toolCallId)

        if (args === undefined) continue
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
        if (stage !== "finished") return undefined
        const id = this.allocateId()
        const item =
          toTaskItem(message.details, id, message.timestamp) ??
          (message.display
            ? {
                id,
                role: "system" as const,
                event: toExtensionMessage(message.customType, message.content),
                timestamp: message.timestamp,
              }
            : undefined)
        return item ? { type: "item_started", item } : undefined
      }

      default:
        return undefined
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
