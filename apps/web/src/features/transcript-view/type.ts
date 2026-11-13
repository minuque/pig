import type { TurnTiming } from "@/types/common-type.js"

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
  /** 工具结果的结构化数据（如任务进展）。 */
  details?: unknown
  /** 历史只带了输出开头；展开时取完整条目。 */
  truncated?: boolean
  /** 单次工具调用的起止时间；没有对应结果时缺省 */
  startedAt?: number
  endedAt?: number
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
  startedAt?: number
  endedAt?: number
  timing?: TurnTiming
}

export type TimelineRow = UserRow | AssistantRow | ToolRow

/** 窗口项：一轮（user 条目 id，无 user 时用 orphan 锚点）。 */
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
