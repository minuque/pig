import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import { canonicalizeWorkspacePath, uniqueCanonicalPaths } from "@client/local-cwd.js"
import { transcriptText } from "@features/transcript-view/index.js"
import { t } from "@i18n/index.js"
import type {
  SessionCardExtra,
  SessionCardLive,
  SessionGroup,
  SidebarGrouping,
  SidebarSection,
  SidebarSession,
  SidebarSort,
} from "@features/session-nav/type.js"
import { sessionRecency, sessionTitle, workspaceName } from "@features/session-nav/lib/format.js"

export const SECTION_PAGE = 5
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

function sortKey(session: Pick<SessionMetadata, "createdAt" | "updatedAt">, sort: SidebarSort) {
  return sort === "created" ? session.createdAt : sessionRecency(session)
}

/** 侧栏会话序：排序键新→旧，同分按 id。 */
export function sortSessionsForSidebar(
  sessions: readonly SessionMetadata[],
  sort: SidebarSort = "updated",
): SessionMetadata[] {
  return [...sessions].sort(
    (left, right) => sortKey(right, sort) - sortKey(left, sort) || left.id.localeCompare(right.id),
  )
}

/** 会话维列表：无 cwd 的 Session 不进侧栏。 */
export function listSessionsForSidebar(
  sessions: readonly SessionMetadata[],
  sort: SidebarSort = "updated",
): SessionMetadata[] {
  return sortSessionsForSidebar(
    sessions.filter((session) => sessionCwd(session) !== undefined),
    sort,
  )
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

/** 本地名单在前（含尚无会话的目录）；其余 Pi Session 按 cwd 跟上。组内按排序键倒序。 */
export function groupSessionsByCwd(
  sessions: readonly SessionMetadata[],
  localWorkspaces: readonly string[],
  sort: SidebarSort = "updated",
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
      sessions: sortSessionsForSidebar(byPath.get(canonicalPath) ?? [], sort),
    })),
    ...[...byPath]
      .filter(([canonicalPath]) => !local.has(canonicalPath))
      .map(([canonicalPath, groupedSessions]) => ({
        canonicalPath,
        sessions: sortSessionsForSidebar(groupedSessions, sort),
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

const DAY = 24 * 60 * 60 * 1000

function localDayStart(now: number): number {
  const date = new Date(now)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** 日期桶：今天 / 昨天 / 近 7 天 / 更早，按排序键的时间戳。 */
function dateBucket(
  session: Pick<SessionMetadata, "createdAt" | "updatedAt">,
  sort: SidebarSort,
  now: number,
): number {
  const age = localDayStart(now) - sortKey(session, sort)

  if (age < 0) return 0

  if (age < DAY) return 1

  if (age < 7 * DAY) return 2
  return 3
}

function dateBucketLabel(bucket: number): string {
  return [
    t("session.bucketToday"),
    t("session.bucketYesterday"),
    t("session.bucketWeek"),
    t("session.bucketEarlier"),
  ][bucket]!
}

function toSection(
  key: string,
  label: string,
  sessions: readonly SessionMetadata[],
  expandedByGroup: Readonly<Record<string, number>>,
  cwd?: string,
): SidebarSection {
  const extra = expandedByGroup[key] ?? 0
  const limit = SECTION_PAGE + extra * SECTION_PAGE
  const shown = Math.min(sessions.length, limit)
  return {
    key,
    label,
    ...(cwd !== undefined ? { cwd } : {}),
    sessions: sessions.slice(0, shown).map(toSidebarSession),
    total: sessions.length,
    shown,
  }
}

/** 侧栏分区：置顶按存储顺序在前；其余按日期或工作目录分组。 */
export function sidebarSections(input: {
  sessions: readonly SessionMetadata[]
  pinnedOrder?: readonly string[]
  grouping: SidebarGrouping
  sort: SidebarSort
  localWorkspaces: readonly string[]
  expandedByGroup: Readonly<Record<string, number>>
  now?: number
}): SidebarSection[] {
  const { grouping, sort, expandedByGroup } = input
  const list = listSessionsForSidebar(input.sessions, sort)
  const sections: SidebarSection[] = []

  if (input.pinnedOrder?.length) {
    const byId = new Map(list.map((session) => [session.id, session]))
    const pinned = input.pinnedOrder.flatMap((id) => {
      const session = byId.get(id)
      return session ? [session] : []
    })

    if (pinned.length) {
      sections.push({
        key: "pinned",
        label: t("session.pinned"),
        sessions: pinned.map(toSidebarSession),
        total: pinned.length,
        shown: pinned.length,
      })
    }
  }

  const pinnedIds = new Set(input.pinnedOrder ?? [])
  const rest = list.filter((session) => !pinnedIds.has(session.id))

  if (grouping === "cwd") {
    for (const group of groupSessionsByCwd(rest, input.localWorkspaces, sort)) {
      if (!group.sessions.length) continue
      sections.push(
        toSection(
          `cwd:${group.canonicalPath}`,
          workspaceName(group.canonicalPath),
          group.sessions,
          expandedByGroup,
          group.canonicalPath,
        ),
      )
    }

    return sections
  }

  const now = input.now ?? Date.now()
  const buckets: SessionMetadata[][] = [[], [], [], []]

  for (const session of rest) buckets[dateBucket(session, sort, now)]!.push(session)

  for (const [bucket, bucketSessions] of buckets.entries()) {
    if (!bucketSessions.length) continue
    sections.push(
      toSection(`date:${bucket}`, dateBucketLabel(bucket), bucketSessions, expandedByGroup),
    )
  }

  return sections
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
