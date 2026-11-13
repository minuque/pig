/** SessionMetadata 不带消息数/模型；侧栏卡片从 Pi 文件投影。 */
export interface SessionCard {
  id: string
  messageCount: number
  model?: { provider: string; id: string }
  outcome?: "complete" | "error"
}

export type TurnTiming = { userId: string; startedAt: number } & (
  | { outcome: "running"; endedAt?: never }
  | { outcome: "complete" | "error" | "aborted"; endedAt: number }
)

export type ContextPreviewKey =
  "systemPrompt" | "memory" | "skills" | "tools" | "toolResults" | "conversation"

export interface ContextUsagePreview {
  key: ContextPreviewKey
  title: string
  content: string
}

export interface ContextUsageEstimate {
  used: number
  window: number
  segments: {
    systemPrompt: number
    memory: number
    skills: number
    tools: number
    toolResults: number
    conversation: number
    other: number
    idle: number
  }
  preview?: ContextUsagePreview
}
