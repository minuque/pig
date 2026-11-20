import type { SessionMetadata } from "@/types/common-type.js"

export interface SessionGroup {
  canonicalPath: string
  sessions: SessionMetadata[]
}

export interface SidebarSession {
  id: string
  title: string
  cwd?: string
  updatedAt: number
  sortKey: number
  draft?: boolean
}

export type SidebarSessionState = "running" | "unread" | "error"

export type SidebarStateGlyph = SidebarSessionState | "draft"

export interface SidebarRowFoot {
  state?: SidebarSessionState | undefined
}

export type SidebarSectionKind = "pinned" | "active" | "working" | "settled"

export interface SidebarPlacement {
  running: boolean
  settled: boolean
}

export interface SidebarSection {
  key: string
  kind: SidebarSectionKind
  label: string
  sessions: SidebarSession[]
  total: number
  shown: number
}

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
