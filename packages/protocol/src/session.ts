import type { TranscriptItem } from "./transcript.js"

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

type TranscriptPageMeta = {
  timings: TurnTiming[]
  hasMore: boolean
  /** 磁盘会话的文件版本；活会话不带。 */
  version?: string
  /** 别处正在跑回合：pig 这边只读。 */
  externalTurn: boolean
}

/** 历史接口的返回；unchanged 表示文件版本与 known 相同；append 是请求 after（`<条目数>:<最后一条 id>`）之后的尾巴。 */
export type SessionTranscriptPage =
  | { unchanged: true }
  | ({ items: TranscriptItem[] } & TranscriptPageMeta)
  | ({ append: TranscriptItem[] } & TranscriptPageMeta)

export type ContextPreviewKey =
  "systemPrompt" | "memory" | "skills" | "tools" | "mcpTools" | "toolResults" | "conversation"

export interface ContextUsagePreview {
  key: ContextPreviewKey
  title: string
  content: string
}

export interface ContextUsageEstimate {
  used: number
  window: number
  /** 模型可用的 MCP 工具数，含按需加载、不占上下文的 */
  mcpToolCount: number
  segments: {
    systemPrompt: number
    memory: number
    skills: number
    tools: number
    mcpTools: number
    toolResults: number
    conversation: number
    other: number
    idle: number
  }
  preview?: ContextUsagePreview
}
