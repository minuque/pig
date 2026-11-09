import type { SessionEntry } from "@earendil-works/pi-coding-agent"
import type {
  AssistantTranscriptItem,
  JsonValue,
  ToolTranscriptItem,
  Usage,
  UserTranscriptItem,
} from "@pig/protocol"

type AgentMessage = Extract<SessionEntry, { type: "message" }>["message"]

type UserMessage = Extract<AgentMessage, { role: "user" }>

type AssistantMessage = Extract<AgentMessage, { role: "assistant" }>

type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>

type ToolCall = Extract<AssistantMessage["content"][number], { type: "toolCall" }>

type PiUsage = AssistantMessage["usage"]

const count = (value: number | undefined) =>
  value === undefined || !Number.isFinite(value) ? undefined : Math.max(0, Math.floor(value))
const money = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0)

/** 执行边界上的值转成协议允许的 JSON：非有限数、函数、循环引用一律拒绝。 */
export function toJsonValue(value: unknown, seen = new Set<object>()): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value

  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Protocol JSON numbers must be finite")
    return value
  }

  if (typeof value !== "object") throw new TypeError(`Unsupported JSON value: ${typeof value}`)

  if (seen.has(value)) throw new TypeError("Protocol JSON values must not be circular")
  seen.add(value)

  try {
    if (Array.isArray(value)) return value.map((entry) => toJsonValue(entry, seen))
    const result: Record<string, JsonValue> = {}

    for (const [key, entry] of Object.entries(value)) result[key] = toJsonValue(entry, seen)
    return result
  } finally {
    seen.delete(value)
  }
}

/** 工具 details 只作展示：无法表示的值有损转换而不报错。 */
function sanitizeDetails(value: unknown, seen = new Set<object>()): JsonValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value

  if (typeof value === "number") return Number.isFinite(value) ? value : String(value)

  if (typeof value === "bigint") return value.toString()

  if (value === undefined || typeof value === "function" || typeof value === "symbol")
    return undefined

  if (value instanceof Date) return value.toISOString()

  if (typeof value !== "object") return String(value)

  if (seen.has(value)) return "[Circular]"
  seen.add(value)

  try {
    if (Array.isArray(value)) return value.map((entry) => sanitizeDetails(entry, seen) ?? null)
    const result: Record<string, JsonValue> = {}

    for (const [key, entry] of Object.entries(value)) {
      const normalized = sanitizeDetails(entry, seen)

      if (normalized !== undefined) result[key] = normalized
    }

    return result
  } finally {
    seen.delete(value)
  }
}

function toUsage(usage: PiUsage | undefined): Usage | undefined {
  if (!usage) return undefined
  const reasoning = count((usage as { reasoning?: number }).reasoning)
  return {
    input: count(usage.input) ?? 0,
    output: count(usage.output) ?? 0,
    cacheRead: count(usage.cacheRead) ?? 0,
    cacheWrite: count(usage.cacheWrite) ?? 0,
    ...(reasoning === undefined ? {} : { reasoning }),
    totalTokens: count(usage.totalTokens) ?? 0,
    cost: {
      input: money(usage.cost.input),
      output: money(usage.cost.output),
      cacheRead: money(usage.cost.cacheRead),
      cacheWrite: money(usage.cost.cacheWrite),
      total: money(usage.cost.total),
    },
  }
}

type Media = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }

function toMedia(content: UserMessage["content"] | ToolResultMessage["content"]): Media[] {
  if (typeof content === "string") return [{ type: "text", text: content }]
  return content.flatMap((part): Media[] => {
    if (part.type === "text") return [{ type: "text", text: part.text }]

    if (part.type === "image") return [{ type: "image", data: part.data, mimeType: part.mimeType }]
    return []
  })
}

export function toUserItem(message: UserMessage, id: string): UserTranscriptItem {
  return { id, role: "user", content: toMedia(message.content), timestamp: message.timestamp }
}

export function toAssistantItem(message: AssistantMessage, id: string): AssistantTranscriptItem {
  const usage = toUsage(message.usage)
  const content = message.content.flatMap((part): AssistantTranscriptItem["content"] => {
    if (part.type === "text") return [{ type: "text", text: part.text }]

    if (part.type === "thinking")
      return [
        {
          type: "thinking",
          thinking: part.thinking,
          ...(part.redacted === undefined ? {} : { redacted: part.redacted }),
        },
      ]

    if (part.type === "toolCall")
      return [
        {
          type: "toolCall",
          toolCallId: part.id,
          toolName: part.name,
          input: toJsonValue(part.arguments),
        },
      ]
    return []
  })
  const common = {
    id,
    role: "assistant" as const,
    content,
    model: { provider: message.provider, id: message.model },
    ...(message.responseModel === undefined ? {} : { responseModel: message.responseModel }),
    ...(usage ? { usage } : {}),
    timestamp: message.timestamp,
  }
  const errorMessage = message.errorMessage ? { errorMessage: message.errorMessage } : {}

  switch (message.stopReason) {
    case "stop":
    case "length":
    case "toolUse":
      return { ...common, status: "complete", stopReason: message.stopReason }
    case "error":
      return { ...common, status: "error", stopReason: "error", ...errorMessage }
    case "aborted":
      return { ...common, status: "aborted", stopReason: "aborted", ...errorMessage }
    default:
      // pending 与 deferred 都还没有最终结果，按流式中展示
      return { ...common, status: "streaming" }
  }
}

export function toToolItem(
  message: ToolResultMessage,
  call: Pick<ToolCall, "id" | "name" | "arguments">,
  id: string,
): ToolTranscriptItem {
  if (message.toolCallId !== call.id || message.toolName !== call.name)
    throw new TypeError(`Tool result ${message.toolCallId} does not match tool call ${call.id}`)
  const details = sanitizeDetails(message.details)
  const usage = toUsage((message as { usage?: PiUsage }).usage)
  const common = {
    id,
    role: "tool" as const,
    toolCallId: call.id,
    toolName: call.name,
    input: toJsonValue(call.arguments),
    content: toMedia(message.content),
    ...(details === undefined ? {} : { details }),
    ...(usage ? { usage } : {}),
    timestamp: message.timestamp,
  }
  return message.isError
    ? { ...common, status: "error", isError: true }
    : { ...common, status: "complete", isError: false }
}
