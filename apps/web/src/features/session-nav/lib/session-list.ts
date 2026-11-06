import type { SessionMetadata, TranscriptItem } from "@/types/common-type.js"
import { canonicalizeWorkspacePath, uniqueCanonicalPaths } from "@client/local-cwd.js"
import { transcriptText } from "@features/transcript-view/index.js"
import { t } from "@i18n/index.js"
import type {
  SessionGroup,
  SidebarPlacement,
  SidebarRowFoot,
  SidebarSection,
  SidebarSession,
  SidebarSort,
  SessionCardExtra,
  SessionCardLive,
} from "@features/session-nav/type.js"
import { sessionRecency, sessionTitle, workspaceName } from "@features/session-nav/lib/format.js"

/** 首屏一次建多少行；够填满侧栏，剩下的滚到底再补。 */
const SECTION_PAGE = 10
/** 收件箱首屏比已归档宽一档：它是主视图，一进来就该能滚。 */
const ACTIVE_PAGE = 25
/** 每次「再放一页」多建的行数。 */
const SECTION_STEP = 25
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

export function toSidebarSession(
  session: SessionMetadata,
  sort: SidebarSort = "updated",
): SidebarSession {
  return {
    id: session.id,
    title: sessionTitle(session),
    sortKey: sortKey(session, sort),
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
  sort: SidebarSort,
  /** 首屏行数；不传就一次全建。 */
  initial?: number,
): SidebarSection {
  const extra = moreBySection[kind] ?? 0
  const shown =
    initial === undefined
      ? sessions.length
      : Math.min(sessions.length, initial + extra * SECTION_STEP)
  return {
    key: kind,
    kind,
    label,
    sessions: sessions.slice(0, shown).map((session) => toSidebarSession(session, sort)),
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
      ? [toSection("pinned", t("session.pinned"), pinned, input.moreBySection, input.sort)]
      : []),
    ...(buckets.active.length
      ? [
          toSection(
            "active",
            t("session.sectionInbox"),
            buckets.active,
            input.moreBySection,
            input.sort,
            ACTIVE_PAGE,
          ),
        ]
      : []),
    ...(buckets.working.length
      ? [
          toSection(
            "working",
            t("session.sectionWorking"),
            buckets.working,
            input.moreBySection,
            input.sort,
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
            input.sort,
            SECTION_PAGE,
          ),
        ]
      : []),
  ]
}

/** 一行 SessionItem 的展示属性：段内行与拖起的浮层共用。 */
export function sidebarItemProps(
  section: SidebarSection,
  session: SidebarSession,
  ctx: {
    highlightedSessionId: string | undefined
    cardFootById: ReadonlyMap<string, SidebarRowFoot>
    pinnedIds: ReadonlySet<string>
    runningSince: Readonly<Record<string, number>>
  },
) {
  const draft = session.draft ?? false
  return {
    session,
    active: session.id === ctx.highlightedSessionId,
    pinned: ctx.pinnedIds.has(session.id),
    settled: section.kind === "settled",
    variant: section.kind === "settled" ? "slim" : "card",
    startedAt: section.kind === "working" ? ctx.runningSince[session.id] : undefined,
    draggable: !draft,
    state: ctx.cardFootById.get(session.id)?.state,
    placeholder: draft,
  } as const
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
