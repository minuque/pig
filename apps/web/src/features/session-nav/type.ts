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

/** 侧栏行脚注里视图消费的那部分，cardFootById 是它的超集。 */
export interface SidebarRowFoot {
  state?: SidebarSessionState | undefined
}

/** 侧栏视图选项：分组与排序，持久化在 localStorage。 */
export type SidebarGrouping = "date" | "cwd"

export type SidebarSort = "updated" | "created"

/** 侧栏一个可折叠分区：Pinned、日期桶或工作目录。 */
export interface SidebarSection {
  key: string
  label: string
  /** cwd 分组的 canonical 路径，供组头图标与「在该项目新建」。 */
  cwd?: string
  sessions: SidebarSession[]
  /** 总数（含未显示的），用来算还能不能 Show more。 */
  total: number
  /** 当前已显示条数。 */
  shown: number
}

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
