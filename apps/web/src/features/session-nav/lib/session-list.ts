import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import { canonicalizeWorkspacePath, uniqueCanonicalPaths } from "@client/local-cwd.js"
import { transcriptText } from "@features/transcript-view/index.js"
import { t } from "@i18n/index.js"
import type {
  SessionGroup,
  SidebarPlacement,
  SidebarSection,
  SidebarSession,
  SidebarSort,
  SessionCardExtra,
  SessionCardLive,
} from "@features/session-nav/type.js"
import { sessionRecency, sessionTitle, workspaceName } from "@features/session-nav/lib/format.js"

export const SECTION_PAGE = 10
/** 已归档每次「显示更多」多放出的行数。 */
export const SETTLED_PAGE = 25
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

/** 项目多选筛选：空集合等于不筛选；按 canonical 路径比对，同名目录不串。 */
export function sessionInProjects(cwd: string | undefined, projects: ReadonlySet<string>): boolean {
  if (projects.size === 0) return true
  return projects.has(canonicalizeWorkspacePath(cwd ?? ""))
}

/** 把 id 移到 slot：slot 按移动前的列表计，拖到原位置下方时不越过目标之后的项。 */
export function moveSessionId(ids: readonly string[], id: string, slot: number): string[] {
  const rest = ids.filter((item) => item !== id)
  let at = Math.min(Math.max(slot, 0), ids.length)

  for (let index = 0; index < at; index += 1) if (ids[index] === id) at -= 1
  rest.splice(Math.min(at, rest.length), 0, id)
  return rest
}

/** 项目筛选用：按 cwd 归拢会话，本地目录排在前面。 */
export function groupSessionsByProject(
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

  const local = new Set(uniqueCanonicalPaths(localWorkspaces))
  return [
    ...[...local].map((canonicalPath) => ({
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

function toSection(
  kind: SidebarSection["kind"],
  label: string,
  sessions: readonly SessionMetadata[],
  moreBySection: Readonly<Record<string, number>>,
  paginate: boolean,
): SidebarSection {
  const extra = moreBySection[kind] ?? 0
  const shown = paginate
    ? Math.min(sessions.length, SECTION_PAGE + extra * SETTLED_PAGE)
    : sessions.length
  return {
    key: kind,
    kind,
    label,
    sessions: sessions.slice(0, shown).map(toSidebarSession),
    total: sessions.length,
    shown,
  }
}

/** 侧栏分段：已归档收走会话，置顶、工作中、收件箱依次分剩下的。 */
export function sidebarSections(input: {
  sessions: readonly SessionMetadata[]
  pinnedOrder?: readonly string[]
  placement: (id: string) => SidebarPlacement
  sort: SidebarSort
  moreBySection: Readonly<Record<string, number>>
}): SidebarSection[] {
  const list = listSessionsForSidebar(input.sessions, input.sort)
  const buckets: Record<"active" | "working" | "settled", SessionMetadata[]> = {
    active: [],
    working: [],
    settled: [],
  }

  for (const session of list) {
    const place = input.placement(session.id)

    if (place.settled) buckets.settled.push(session)
    else if (place.running) buckets.working.push(session)
    else buckets.active.push(session)
  }

  const byId = new Map(list.map((session) => [session.id, session]))
  const pinned = (input.pinnedOrder ?? []).flatMap((id) => {
    const session = byId.get(id)

    if (!session) return []
    const place = input.placement(id)
    return place.settled ? [] : [session]
  })
  const pinnedIds = new Set(pinned.map((session) => session.id))

  buckets.active = buckets.active.filter((session) => !pinnedIds.has(session.id))
  buckets.working = buckets.working.filter((session) => !pinnedIds.has(session.id))
  return [
    ...(pinned.length
      ? [toSection("pinned", t("session.pinned"), pinned, input.moreBySection, false)]
      : []),
    ...(buckets.active.length
      ? [toSection("active", t("session.sectionInbox"), buckets.active, input.moreBySection, false)]
      : []),
    ...(buckets.working.length
      ? [
          toSection(
            "working",
            t("session.sectionWorking"),
            buckets.working,
            input.moreBySection,
            false,
          ),
        ]
      : []),
    ...(list.length
      ? [
          toSection(
            "settled",
            t("session.sectionSettled"),
            buckets.settled,
            input.moreBySection,
            true,
          ),
        ]
      : []),
  ]
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
