import type { SessionMetadata, WorkspaceGit } from "@/types/common-type.js"

export interface SessionGroup {
  canonicalPath: string
  sessions: SessionMetadata[]
}

export interface SidebarSession {
  id: string
  title: string
  cwd?: string
  createdAt: number
  updatedAt: number
  sortKey: number
  draft?: boolean
}

export type SidebarSessionState = "waiting" | "running" | "unread" | "error"

export type SidebarStateGlyph = SidebarSessionState | "draft"

export interface SidebarParentSession {
  id: string
  title: string
  cwd: string | undefined
  updatedAt: number
  model: { provider: string; id: string } | undefined
}

export interface SidebarRowFoot {
  state: SidebarSessionState | undefined
  model: { provider: string; id: string } | undefined
  messageCount: number | undefined
  parent?: SidebarParentSession
  git?: WorkspaceGit
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
