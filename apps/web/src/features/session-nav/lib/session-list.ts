import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import { canonicalizeWorkspacePath, uniqueCanonicalPaths } from "@client/local-cwd.js"
import { transcriptText } from "@features/transcript-view/index.js"
import type {
  SessionCardExtra,
  SessionCardLive,
  SessionGroup,
  SidebarGrouping,
  SidebarRow,
  SidebarSort,
  SidebarSession,
} from "@features/session-nav/type.js"
import { sessionRecency, sessionTitle, workspaceName } from "@features/session-nav/lib/format.js"

export const UPDATED_PAGE = 10
export const PROJECT_PAGE = 5
/** 临时新会话占位行的 id 前缀。 */
export const DRAFT_SESSION_PREFIX = "draft:"

export function draftSessionId(canonicalPath: string): string {
  return `${DRAFT_SESSION_PREFIX}${canonicalPath}`
}

export function isDraftSessionId(id: string): boolean {
  return id.startsWith(DRAFT_SESSION_PREFIX)
}

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

function groupRecency(group: SessionGroup): number {
  return group.sessions.reduce((latest, session) => Math.max(latest, sessionRecency(session)), 0)
}

/** 分组目录顺序。手动按已记住的路径，未记录的保持原顺序排在后面；最近活动按组内最新会话。 */
export function orderSessionGroups(
  groups: readonly SessionGroup[],
  sort: SidebarSort,
  manualOrder: readonly string[],
): SessionGroup[] {
  if (sort === "recent") {
    return groups
      .map((group, index) => ({ group, index }))
      .sort(
        (left, right) =>
          groupRecency(right.group) - groupRecency(left.group) ||
          left.group.canonicalPath.localeCompare(right.group.canonicalPath) ||
          left.index - right.index,
      )
      .map((item) => item.group)
  }

  const indexByPath = new Map(manualOrder.map((path, index) => [path, index]))
  return groups
    .map((group, index) => ({ group, index }))
    .sort((left, right) => {
      const leftOrder = indexByPath.get(left.group.canonicalPath)
      const rightOrder = indexByPath.get(right.group.canonicalPath)

      if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder

      if (leftOrder !== undefined) return -1

      if (rightOrder !== undefined) return 1
      return left.index - right.index
    })
    .map((item) => item.group)
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

  const localPaths = uniqueCanonicalPaths(localWorkspaces)
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

export function toSidebarSession(session: SessionMetadata): SidebarSession {
  return {
    id: session.id,
    title: sessionTitle(session),
    ...(session.cwd !== undefined ? { cwd: session.cwd } : {}),
    updatedAt: sessionRecency(session),
    ...(isDraftSessionId(session.id) ? { draft: true } : {}),
  }
}

function sliceVisible(
  sessions: readonly SessionMetadata[],
  groupKey: string,
  page: number,
  expandedByGroup: Readonly<Record<string, boolean>>,
  searching: boolean,
): { sessions: SidebarSession[]; more: boolean; revealed: boolean } {
  const revealed = !searching && expandedByGroup[groupKey] === true
  const limit = searching || revealed ? sessions.length : page
  const visible = sessions.slice(0, limit)
  const more = !searching && sessions.length > page
  return {
    sessions: visible.map(toSidebarSession),
    more,
    revealed: more && revealed,
  }
}

function appendGroupSessions(
  rows: SidebarRow[],
  sessions: readonly SessionMetadata[],
  groupKey: string,
  page: number,
  expandedByGroup: Readonly<Record<string, boolean>>,
  searching: boolean,
): void {
  const sliced = sliceVisible(sessions, groupKey, page, expandedByGroup, searching)

  for (const session of sliced.sessions) {
    rows.push({ kind: "session", key: session.id, session })
  }

  if (sliced.more) {
    rows.push({ kind: "more", key: `more:${groupKey}`, groupKey, revealed: sliced.revealed })
  }
}

/** 侧栏虚拟列表行：更新时间平铺；项目按 groups 出组头。searching 取消截断与折叠。 */
export function sidebarRows(input: {
  grouping: SidebarGrouping
  sessions: readonly SessionMetadata[]
  groups: readonly SessionGroup[]
  expandedByGroup: Readonly<Record<string, boolean>>
  searching: boolean
  collapsedByGroup?: Readonly<Record<string, boolean>>
}): SidebarRow[] {
  const { grouping, sessions, groups, expandedByGroup, searching, collapsedByGroup = {} } = input

  if (grouping === "updated") {
    const rows: SidebarRow[] = []
    appendGroupSessions(
      rows,
      listSessionsForSidebar(sessions),
      "updated",
      UPDATED_PAGE,
      expandedByGroup,
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
      expandedByGroup,
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
      revealed: sliced.revealed,
    })
  }

  return rows
}

export function sessionCardFoot(
  sessionId: string,
  extras: ReadonlyMap<string, SessionCardExtra>,
  live: SessionCardLive | undefined,
): {
  messageCount: number | undefined
  outcome: "complete" | "error" | undefined
  model: { provider: string; id: string } | undefined
} {
  const extra = extras.get(sessionId)
  const isLive = live?.sessionId === sessionId
  return {
    messageCount: isLive ? (live.messageCount ?? extra?.messageCount) : extra?.messageCount,
    outcome: isLive ? (live.outcome ?? extra?.outcome) : extra?.outcome,
    model: isLive ? (live.model ?? extra?.model) : extra?.model,
  }
}

function isRetryErrorItem(item: TranscriptItem): boolean {
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

/** 当前分支最后一条助手消息的结果，供打开中的会话即时覆盖磁盘卡片。 */
export function sessionOutcome(items: readonly TranscriptItem[]): "complete" | "error" | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]

    if (item?.role !== "assistant") continue
    return item.status === "error" ? "error" : "complete"
  }

  return undefined
}
