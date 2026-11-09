import type { ModelRef } from "./model.js"

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type TextContent = { type: "text"; text: string }

type ImageContent = { type: "image"; data: string; mimeType: string }

type ThinkingContent = { type: "thinking"; thinking: string; redacted?: boolean }

type ToolCallContent = { type: "toolCall"; toolCallId: string; toolName: string; input: JsonValue }

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  reasoning?: number
  totalTokens: number
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
}

export interface UserTranscriptItem {
  id: string
  role: "user"
  content: Array<TextContent | ImageContent>
  timestamp: number
}

interface AssistantBase {
  id: string
  role: "assistant"
  content: Array<TextContent | ThinkingContent | ToolCallContent>
  model: ModelRef
  responseModel?: string
  usage?: Usage
  timestamp: number
}

type StreamingAssistant = AssistantBase & { status: "streaming" }

type CompleteAssistant = AssistantBase & {
  status: "complete"
  stopReason: "stop" | "length" | "toolUse"
}

type ErrorAssistant = AssistantBase & {
  status: "error"
  stopReason: "error"
  errorMessage?: string
}

type AbortedAssistant = AssistantBase & {
  status: "aborted"
  stopReason: "aborted"
  errorMessage?: string
}

export type AssistantTranscriptItem =
  StreamingAssistant | CompleteAssistant | ErrorAssistant | AbortedAssistant

interface ToolBase {
  id: string
  role: "tool"
  toolCallId: string
  toolName: string
  input: JsonValue
  content: Array<TextContent | ImageContent>
  details?: JsonValue
  usage?: Usage
  timestamp: number
}

type RunningTool = ToolBase & { status: "running"; isError: false }

type CompleteTool = ToolBase & { status: "complete"; isError: false }

type ErrorTool = ToolBase & { status: "error"; isError: true }

export type ToolTranscriptItem = RunningTool | CompleteTool | ErrorTool

export type TranscriptItem = UserTranscriptItem | AssistantTranscriptItem | ToolTranscriptItem

/** 增量活动；快照始终是权威。 */
export type TranscriptProgress =
  | { type: "item_started"; item: TranscriptItem }
  | {
      type: "assistant_delta"
      messageId: string
      contentIndex: number
      kind: "text" | "thinking" | "toolCall"
      delta: string
    }
  | { type: "item_updated"; item: AssistantTranscriptItem | ToolTranscriptItem }
  | {
      type: "item_finished"
      item: CompleteAssistant | ErrorAssistant | AbortedAssistant | CompleteTool | ErrorTool
    }
