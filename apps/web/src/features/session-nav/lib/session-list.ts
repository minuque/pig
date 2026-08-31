import type { SessionMetadata, TranscriptItem } from "@earendil-works/pi-protocol"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { sessionRecency, sessionTitle, workspaceName } from "./format.js"

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

export type SidebarGrouping = "updated" | "project"

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

export const UPDATED_PAGE = 10
export const PROJECT_PAGE = 5

function sessionCwd(session: Pick<SessionMetadata, "cwd">): string | undefined {
  return session.cwd ? canonicalizeWorkspacePath(session.cwd) : undefined
}

/** 侧栏会话序：sessionRecency 新→旧，同分按 id。 */
export function sortSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort(
    (left, right) =>
      sessionRecency(right) - sessionRecency(left) || left.id.localeCompare(right.id),
  )
}

/** 会话维列表：无 cwd 的 Session 不进侧栏。 */
export function listSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return sortSessionsForSidebar(sessions.filter((session) => sessionCwd(session) !== undefined))
}

/** 按标题或目录名过滤侧栏会话，空查询原样返回。 */
export function filterSessionsForSearch(
  sessions: readonly SessionMetadata[],
  query: string,
): SessionMetadata[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...sessions]
  return sessions.filter((session) => {
    if (sessionTitle(session).toLowerCase().includes(needle)) return true
    const cwd = session.cwd
    return Boolean(cwd && workspaceName(cwd).toLowerCase().includes(needle))
  })
}

/** 本地名单在前（含尚无会话的目录）；其余 Pi Session 按 cwd 跟上。组内按最近活动倒序。 */
export function groupSessionsByCwd(
  sessions: readonly SessionMetadata[],
  localWorkspaces: readonly string[],
): SessionGroup[] {
  const byPath = new Map<string, SessionMetadata[]>()
  for (const session of sessions) {
    const cwd = sessionCwd(session)
    if (!cwd) continue
    const list = byPath.get(cwd)
    if (list) list.push(session)
    else byPath.set(cwd, [session])
  }
  const localPaths = localWorkspaces.map(canonicalizeWorkspacePath)
  const local = new Set(localPaths)
  return [
    ...localPaths.map((canonicalPath) => ({
      canonicalPath,
      sessions: sortSessionsForSidebar(byPath.get(canonicalPath) ?? []),
    })),
    ...[...byPath]
      .filter(([canonicalPath]) => !local.has(canonicalPath))
      .map(([canonicalPath, groupedSessions]) => ({
        canonicalPath,
        sessions: sortSessionsForSidebar(groupedSessions),
      })),
  ]
}

function sidebarSession(session: SessionMetadata): SidebarSession {
  return {
    id: session.id,
    title: sessionTitle(session),
    ...(session.cwd !== undefined ? { cwd: session.cwd } : {}),
    updatedAt: sessionRecency(session),
  }
}

function sliceVisible(
  sessions: readonly SessionMetadata[],
  groupKey: string,
  page: number,
  revealByGroup: Readonly<Record<string, number>>,
  searching: boolean,
): { sessions: SidebarSession[]; more: boolean } {
  const limit = searching ? sessions.length : (revealByGroup[groupKey] ?? page)
  const visible = sessions.slice(0, limit)
  return {
    sessions: visible.map(sidebarSession),
    more: !searching && visible.length < sessions.length,
  }
}

function appendGroupSessions(
  rows: SidebarRow[],
  sessions: readonly SessionMetadata[],
  groupKey: string,
  page: number,
  revealByGroup: Readonly<Record<string, number>>,
  searching: boolean,
): void {
  const sliced = sliceVisible(sessions, groupKey, page, revealByGroup, searching)
  for (const session of sliced.sessions) {
    rows.push({ kind: "session", key: session.id, session })
  }
  if (sliced.more) rows.push({ kind: "more", key: `more:${groupKey}`, groupKey })
}

/** 侧栏虚拟列表行：更新时间平铺；项目按 groups 出组头。searching 取消截断与折叠。 */
export function sidebarRows(input: {
  grouping: SidebarGrouping
  sessions: readonly SessionMetadata[]
  groups: readonly SessionGroup[]
  revealByGroup: Readonly<Record<string, number>>
  searching: boolean
  collapsedByGroup?: Readonly<Record<string, boolean>>
}): SidebarRow[] {
  const { grouping, sessions, groups, revealByGroup, searching, collapsedByGroup = {} } = input
  if (grouping === "updated") {
    const rows: SidebarRow[] = []
    appendGroupSessions(
      rows,
      listSessionsForSidebar(sessions),
      "updated",
      UPDATED_PAGE,
      revealByGroup,
      searching,
    )
    return rows
  }
  const rows: SidebarRow[] = []
  for (const [index, group] of groups.entries()) {
    const collapsed = !searching && Boolean(collapsedByGroup[group.canonicalPath])
    const sliced = sliceVisible(
      group.sessions,
      group.canonicalPath,
      PROJECT_PAGE,
      revealByGroup,
      searching,
    )
    rows.push({
      kind: "group",
      key: group.canonicalPath,
      canonicalPath: group.canonicalPath,
      first: index === 0,
      collapsed,
      sessions: sliced.sessions,
      more: sliced.more,
    })
  }
  return rows
}

/** 协议列表不带的卡片脚注：消息数 + 当前模型。 */
export interface SessionCardExtra {
  messageCount: number
  model?: { provider: string; id: string }
}

export interface SessionCardLive {
  sessionId: string
  messageCount?: number
  model: { provider: string; id: string }
}

export function sessionCardFoot(
  sessionId: string,
  extras: ReadonlyMap<string, SessionCardExtra>,
  live: SessionCardLive | undefined,
): { messageCount: number | undefined; modelProvider: string } {
  const extra = extras.get(sessionId)
  const isLive = live?.sessionId === sessionId
  const model = isLive ? live.model : extra?.model
  return {
    messageCount: isLive ? (live.messageCount ?? extra?.messageCount) : extra?.messageCount,
    modelProvider: model?.provider ?? "",
  }
}

function transcriptText(item: TranscriptItem): string {
  return item.content
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("")
}

/** 空失败助手句是自动重试残留，不进侧栏条数。 */
export function isRetryErrorItem(item: TranscriptItem): boolean {
  if (item.role !== "assistant") return false
  if (item.status !== "error" && item.status !== "aborted") return false
  return transcriptText(item).length === 0
}

/** 侧栏一条：User / Assistant / Tool Call；空失败助手句不计。 */
export function conversationItemCount(items: readonly TranscriptItem[]): number {
  let count = 0
  for (const item of items) {
    if (item.role !== "user" && item.role !== "assistant" && item.role !== "tool") continue
    if (isRetryErrorItem(item)) continue
    count += 1
  }
  return count
}
