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
  SessionCardExtra,
  SessionCardLive,
} from "@features/session-nav/type.js"
import { sessionRecency, workspaceName } from "@features/session-nav/lib/format.js"
import { sessionTitle } from "@features/session/index.js"

const SECTION_PAGE = 10
const ACTIVE_PAGE = 25
const SECTION_STEP = 25
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

export function sortSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return [...sessions].sort(
    (left, right) =>
      sessionRecency(right) - sessionRecency(left) || left.id.localeCompare(right.id),
  )
}

export function listSessionsForSidebar(sessions: readonly SessionMetadata[]): SessionMetadata[] {
  return sortSessionsForSidebar(sessions.filter((session) => sessionCwd(session) !== undefined))
}

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

export function sessionInProjects(cwd: string | undefined, projects: ReadonlySet<string>): boolean {
  if (projects.size === 0) return true
  return projects.has(canonicalizeWorkspacePath(cwd ?? ""))
}

export function moveSessionId(ids: readonly string[], id: string, slot: number): string[] {
  const rest = ids.filter((item) => item !== id)
  let at = Math.min(Math.max(slot, 0), ids.length)

  for (let index = 0; index < at; index += 1) if (ids[index] === id) at -= 1
  rest.splice(Math.min(at, rest.length), 0, id)
  return rest
}

export function groupSessionsByProject(
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

  const local = new Set(uniqueCanonicalPaths(localWorkspaces))
  return [
    ...[...local].map((canonicalPath) => ({
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
    sortKey: sessionRecency(session),
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
    sessions: sessions.slice(0, shown).map((session) => toSidebarSession(session)),
    total: sessions.length,
    shown,
  }
}

export function sidebarSections(input: {
  sessions: readonly SessionMetadata[]
  pinnedOrder?: readonly string[]
  placement: (id: string) => SidebarPlacement
  moreBySection: Readonly<Record<string, number>>
}): SidebarSection[] {
  const list = listSessionsForSidebar(input.sessions)
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
      ? [toSection("pinned", t("session.pinned"), pinned, input.moreBySection)]
      : []),
    ...(buckets.active.length
      ? [
          toSection(
            "active",
            t("session.sectionInbox"),
            buckets.active,
            input.moreBySection,
            ACTIVE_PAGE,
          ),
        ]
      : []),
    ...(buckets.working.length
      ? [toSection("working", t("session.sectionWorking"), buckets.working, input.moreBySection)]
      : []),
    ...(list.length
      ? [
          toSection(
            "settled",
            t("session.sectionSettled"),
            buckets.settled,
            input.moreBySection,
            SECTION_PAGE,
          ),
        ]
      : []),
  ]
}

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
    startedAt: ctx.runningSince[session.id],
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

export function conversationItemCount(items: readonly TranscriptItem[]): number {
  let count = 0

  for (const item of items) {
    if (item.role !== "user" && item.role !== "assistant" && item.role !== "tool") continue

    if (isRetryErrorItem(item)) continue
    count += 1
  }

  return count
}

export function sessionOutcome(items: readonly TranscriptItem[]): "complete" | "error" | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]

    if (item?.role !== "assistant") continue
    return item.status === "error" ? "error" : "complete"
  }

  return undefined
}
