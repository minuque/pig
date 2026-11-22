import type { ModelRef, Task, ThinkingLevel, TurnTiming } from "@/types/common-type.js"

export type TranscriptImage = { data: string; mimeType: string }

export type UserRow = {
  id: string
  role: "user"
  text: string
  images: TranscriptImage[]
  timestamp: number
}

export type AssistantRow = {
  id: string
  role: "assistant"
  text: string
  streaming: boolean
  error: boolean
  aborted: boolean
  timestamp: number
  showTimestamp?: boolean
  errorMessage?: string
}

export type ToolCallView = {
  id: string
  toolName: string
  running: boolean
  isError: boolean
  input: unknown
  outputText: string
  outputImages: TranscriptImage[]
  details?: unknown
  truncated?: boolean
  startedAt?: number
  endedAt?: number
}

export type ToolGroupKey = "read" | "write" | "edit" | "command" | "search" | "tool"

export type ToolGroup = { type: "tools"; id: string; key: ToolGroupKey; items: ToolCallView[] }

export type ThoughtStep = {
  type: "thought"
  id: string
  text: string
  streaming: boolean
  startedAt: number
  endedAt?: number
}

export type ToolRowStep = ThoughtStep | ToolGroup

export type ToolRow = {
  id: string
  role: "tools"
  mode: "live" | "done"
  turnStreaming: boolean
  steps: ToolRowStep[]
  aborted: boolean
  error: boolean
  startedAt?: number
  endedAt?: number
  timing?: TurnTiming
}

export type TaskNoticeRow = {
  id: string
  role: "task"
  task: Task
  timestamp: number
}

export type ModelSetting = { model?: ModelRef; thinkingLevel?: ThinkingLevel }

export type RetryAttempt = { timestamp: number; errorMessage: string }

export type EventPart =
  | { kind: "model"; from: ModelSetting; to: ModelSetting }
  | { kind: "compaction"; tokensBefore: number; summary: string }
  | { kind: "branch_summary"; summary: string }
  | { kind: "compaction_failed"; errorMessage: string }
  | { kind: "retry_recovered"; attempts: RetryAttempt[] }
  | { kind: "aborted" }

export type EventRow = { id: string; role: "event"; parts: EventPart[]; timestamp: number }

export type AlertRow = {
  id: string
  role: "alert"
  source: "request" | "extension"
  level: "warning" | "error"
  message: string
  retries: number
  timestamp: number
}

export type ExtensionRow = {
  id: string
  role: "extension"
  customType: string
  text: string
  images: TranscriptImage[]
  timestamp: number
}

export type TimelineRow =
  UserRow | AssistantRow | ToolRow | TaskNoticeRow | EventRow | AlertRow | ExtensionRow

export type TimelineTurn = {
  id: string
  rows: TimelineRow[]
}

export type EditDiffHunk = { original: string; modified: string }

export type EditDiffPreview = {
  path: string
  fileName: string
  language: string
  hunks: EditDiffHunk[]
  added: number
  removed: number
}

export interface TranscriptMinimapItem {
  id: string
  userText: string | null
  assistantText: string | null
}
