import type { TurnTiming } from "@/types/turn-type.js"

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
  retryCount?: number
}

export type ToolCallView = {
  id: string
  toolName: string
  running: boolean
  isError: boolean
  input: unknown
  outputText: string
  outputImages: TranscriptImage[]
}

/** Pi 内置：read / write / edit / bash|powershell / grep|find|ls，其余为 tool。 */
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
  timing?: TurnTiming
}
export type TimelineRow = UserRow | AssistantRow | ToolRow

export type ToolSummaryDetail =
  | { kind: "file"; name: string; path: string; added?: number; removed?: number }
  | { kind: "text"; text: string }

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
  rowIndex: number
  userText: string | null
  assistantText: string | null
}
