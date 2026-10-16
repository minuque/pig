import type { SessionMetadata } from "@/types/common-type.js"

/** 左侧导航按 cwd 分组。 */
export interface SessionGroup {
  canonicalPath: string
  sessions: SessionMetadata[]
}

/** 侧栏会话行：id、标题、时间；cwd 供组名展示。 */
export interface SidebarSession {
  id: string
  title: string
  cwd?: string
  updatedAt: number
  /** 临时新会话占位行。 */
  draft?: boolean
}

export type SidebarSessionState = "running" | "unread" | "error"

export type SidebarRow =
  | { kind: "session"; key: string; session: SidebarSession }
  | { kind: "more"; key: string; groupKey: string; revealed: boolean }

/** 协议列表不带的卡片脚注：消息数 + 当前模型。 */
export interface SessionCardExtra {
  messageCount: number
  model?: { provider: string; id: string }
  outcome?: "complete" | "error"
}

export interface SessionCardLive {
  sessionId: string
  messageCount?: number
  model: { provider: string; id: string }
  outcome?: "complete" | "error"
}
