import type { SessionMetadata } from "@/types/common-type.js"

/** 项目筛选用的会话分组。 */
export interface SessionGroup {
  canonicalPath: string
  sessions: SessionMetadata[]
}

/** 侧栏会话行：id、标题、时间；cwd 供第二行项目名。 */
export interface SidebarSession {
  id: string
  title: string
  cwd?: string
  updatedAt: number
  /** 临时新会话占位行。 */
  draft?: boolean
}

export type SidebarSessionState = "running" | "unread" | "error"

/** 侧栏状态图标：draft 不是协议状态，由本地草稿标记推出来。 */
export type SidebarStateGlyph = SidebarSessionState | "draft"

/** 侧栏行脚注里视图消费的那部分，cardFootById 是它的超集。 */
export interface SidebarRowFoot {
  state?: SidebarSessionState | undefined
}

/** 侧栏排序，持久化在 localStorage。 */
export type SidebarSort = "updated" | "created"

/** 侧栏固定分段。 */
export type SidebarSectionKind = "pinned" | "active" | "working" | "settled"

/** 一个会话此刻的落脚信息，决定它进哪一段。 */
export interface SidebarPlacement {
  running: boolean
  settled: boolean
}

/** 侧栏一个可折叠分区：置顶、收件箱、工作中或已归档。 */
export interface SidebarSection {
  key: string
  kind: SidebarSectionKind
  label: string
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
