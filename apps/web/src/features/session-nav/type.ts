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
}

export interface SidebarTimeSection {
  key: "today" | "recent"
  name: "今天" | "最近"
  sessions: SidebarSession[]
}

export type SidebarGrouping = "updated" | "project"
export type SidebarSessionState = "running" | "unread" | "error"

export type SidebarRow =
  | {
      kind: "group"
      key: string
      canonicalPath: string
      first: boolean
      collapsed: boolean
      sessions: SidebarSession[]
      more: boolean
    }
  | { kind: "session"; key: string; session: SidebarSession }
  | { kind: "more"; key: string; groupKey: string }

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
