import type { SessionMetadata } from "@earendil-works/pi-protocol"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { sessionRecency, sessionTitle, workspaceName } from "./format.js"

/** 左侧导航按 cwd 分组。 */
export interface SessionGroup {
  canonicalPath: string
  sessions: SessionMetadata[]
}

export type SidebarGrouping = "updated" | "project"

export type SidebarRow =
  | { kind: "group"; key: string; canonicalPath: string; first: boolean; collapsed: boolean }
  | { kind: "session"; key: string; session: SessionMetadata }
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

function appendGroupSessions(
  rows: SidebarRow[],
  sessions: readonly SessionMetadata[],
  groupKey: string,
  page: number,
  revealByGroup: Readonly<Record<string, number>>,
  searching: boolean,
): void {
  const limit = searching ? sessions.length : (revealByGroup[groupKey] ?? page)
  const visible = sessions.slice(0, limit)
  for (const session of visible) {
    rows.push({ kind: "session", key: session.id, session })
  }
  if (!searching && visible.length < sessions.length) {
    rows.push({ kind: "more", key: `more:${groupKey}`, groupKey })
  }
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
    rows.push({
      kind: "group",
      key: group.canonicalPath,
      canonicalPath: group.canonicalPath,
      first: index === 0,
      collapsed,
    })
    if (collapsed) continue
    appendGroupSessions(
      rows,
      group.sessions,
      group.canonicalPath,
      PROJECT_PAGE,
      revealByGroup,
      searching,
    )
  }
  return rows
}

/** 缺省视为已露出一页，再加一页。 */
export function bumpReveal(current: number | undefined, page: number): number {
  return (current ?? page) + page
}

/** 当前会话变化或尚未跟滚过时才跟；分页展开改 rows 不跟。 */
export function shouldFollowActiveSession(
  activeId: string | undefined,
  followedId: string | undefined,
): boolean {
  return activeId !== undefined && activeId !== followedId
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

export function modelDisplayNames(
  catalog: readonly { id: string; models: readonly { id: string; name: string }[] }[],
): Map<string, string> {
  const names = new Map<string, string>()
  for (const vendor of catalog) {
    for (const model of vendor.models) names.set(`${vendor.id}/${model.id}`, model.name)
  }
  return names
}

export function sessionModelLabel(
  model: { provider: string; id: string } | undefined,
  names: ReadonlyMap<string, string>,
): string {
  if (!model) return ""
  return names.get(`${model.provider}/${model.id}`) ?? model.id
}

export function sessionCardFoot(
  sessionId: string,
  extras: ReadonlyMap<string, SessionCardExtra>,
  live: SessionCardLive | undefined,
  names: ReadonlyMap<string, string>,
): { messageCount: number | undefined; modelLabel: string; modelProvider: string } {
  const extra = extras.get(sessionId)
  const isLive = live?.sessionId === sessionId
  const model = isLive ? live.model : extra?.model
  return {
    messageCount: isLive ? (live.messageCount ?? extra?.messageCount) : extra?.messageCount,
    modelLabel: sessionModelLabel(model, names),
    modelProvider: model?.provider ?? "",
  }
}
