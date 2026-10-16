import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import { canonicalizeWorkspacePath, uniqueCanonicalPaths } from "@client/local-cwd.js"
import { transcriptText } from "@features/transcript-view/index.js"
import type {
  SessionCardExtra,
  SessionCardLive,
  SessionGroup,
  SidebarRow,
  SidebarSession,
} from "@features/session-nav/type.js"
import { sessionRecency, sessionTitle, workspaceName } from "@features/session-nav/lib/format.js"

export const UPDATED_PAGE = 10
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

/** 侧栏虚拟列表行：pinned 在前，其余按更新时间平铺。searching 取消截断。 */
export function sidebarRows(input: {
  sessions: readonly SessionMetadata[]
  pinnedIds?: ReadonlySet<string>
  expandedByGroup: Readonly<Record<string, boolean>>
  searching: boolean
}): SidebarRow[] {
  const { sessions, pinnedIds, expandedByGroup, searching } = input
  const rows: SidebarRow[] = []
  const list = listSessionsForSidebar(sessions)

  if (pinnedIds?.size) {
    const pinned = list.filter((s) => pinnedIds.has(s.id))
    const rest = list.filter((s) => !pinnedIds.has(s.id))

    for (const session of pinned) {
      rows.push({ kind: "session", key: session.id, session: toSidebarSession(session) })
    }

    appendGroupSessions(rows, rest, "updated", UPDATED_PAGE, expandedByGroup, searching)
    return rows
  }

  appendGroupSessions(rows, list, "updated", UPDATED_PAGE, expandedByGroup, searching)
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
