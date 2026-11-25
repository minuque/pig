import type { ComputedRef } from "vue"
import type { SessionArchives, SessionMetadata } from "@/types/common-type.js"
import type { ToneColor } from "@pig/ui"

export const STALE_SESSION_DAYS = 7
export const STALE_SESSION_MS = STALE_SESSION_DAYS * 24 * 60 * 60 * 1000
export const ARCHIVE_GROUP_HEAD_FIRST_HEIGHT = 36
export const ARCHIVE_GROUP_HEAD_HEIGHT = 52
export const ARCHIVE_ROW_HEIGHT = 60

export type ArchiveTab = "inbox" | "archived"

export type ArchiveQuickRule = "stale" | "settled" | "error"

export type ArchiveRowStatus = "running" | "settled" | "error" | "idle"

export interface ArchiveProjectView {
  readonly cwd: string
  readonly name: string
  readonly monogram: string
  readonly tone: ToneColor
  readonly iconName?: string | undefined
}

export interface ArchiveSessionFoot {
  readonly messageCount: number | undefined
  readonly model: { readonly provider: string; readonly id: string } | undefined
  readonly state: "running" | "unread" | "error" | undefined
}

export interface ArchiveSessionRow {
  readonly id: string
  readonly cwd: string
  readonly title: string
  readonly provider?: string | undefined
  readonly model?: string | undefined
  readonly messageCount: number
  readonly createdAt: number
  readonly lastActiveAt: number
  readonly archivedAt?: number | undefined
  readonly running: boolean
  readonly settled: boolean
  readonly errored: boolean
  readonly stale: boolean
  readonly status: ArchiveRowStatus
}

export interface ArchiveProjectGroup {
  readonly project: ArchiveProjectView
  readonly rows: ArchiveSessionRow[]
  readonly staleIds: string[]
  readonly selectableIds: string[]
}

export type ArchiveVirtualItem =
  | {
      readonly kind: "group-head"
      readonly key: string
      readonly group: ArchiveProjectGroup
      readonly firstGroup: boolean
    }
  | {
      readonly kind: "row"
      readonly key: string
      readonly row: ArchiveSessionRow
      readonly isFirst: boolean
      readonly isLast: boolean
    }

export interface ArchiveController {
  readonly allSessions: ComputedRef<readonly SessionMetadata[]>
  readonly settledIds: ComputedRef<ReadonlySet<string>>
  readonly runningIds: ComputedRef<ReadonlySet<string>>
  readonly cardFootById: ComputedRef<ReadonlyMap<string, ArchiveSessionFoot>>
  readonly projectByCwd: ComputedRef<ReadonlyMap<string, ArchiveProjectView>>
  archiveSessions(ids: readonly string[]): Promise<void>
  unarchiveSessions(ids: readonly string[]): Promise<void>
  deleteSessions(ids: readonly string[]): Promise<void>
}

export interface BuildArchiveRowsInput {
  readonly sessions: readonly SessionMetadata[]
  readonly archives: SessionArchives
  readonly settledIds: ReadonlySet<string>
  readonly runningIds: ReadonlySet<string>
  readonly cardFootById: ReadonlyMap<string, ArchiveSessionFoot>
  readonly tab: ArchiveTab
  readonly untitledLabel: string
  readonly now?: number | undefined
}

function sessionLastActive(session: Pick<SessionMetadata, "createdAt" | "updatedAt">): number {
  return session.updatedAt ?? session.createdAt
}

export function countArchiveTabs(
  sessions: readonly SessionMetadata[],
  archives: SessionArchives,
): { inbox: number; archived: number } {
  let archived = 0

  for (const session of sessions) {
    if (archives[session.id] !== undefined) archived += 1
  }

  return { inbox: sessions.length - archived, archived }
}

export function countQuickRules(
  rows: readonly ArchiveSessionRow[],
): Record<ArchiveQuickRule, number> {
  const counts: Record<ArchiveQuickRule, number> = { stale: 0, settled: 0, error: 0 }

  for (const row of rows) {
    if (row.running) continue

    if (row.stale) counts.stale += 1

    if (row.settled) counts.settled += 1

    if (row.errored) counts.error += 1
  }

  return counts
}

export function fallbackProjectView(cwd: string): ArchiveProjectView {
  const normalized = cwd.replace(/\\/g, "/").replace(/\/+$/, "")
  const name = normalized.split("/").filter(Boolean).pop() || cwd || "~"
  const monogram = name.slice(0, 2).toUpperCase()
  return { cwd, name, monogram, tone: "neutral" }
}

export function buildArchiveRows(input: BuildArchiveRowsInput): ArchiveSessionRow[] {
  const now = input.now ?? Date.now()
  const rows: ArchiveSessionRow[] = []

  for (const session of input.sessions) {
    const archivedAt = input.archives[session.id]
    const isArchived = archivedAt !== undefined

    if (input.tab === "archived" ? !isArchived : isArchived) continue

    const lastActiveAt = sessionLastActive(session)
    const foot = input.cardFootById.get(session.id)
    const running = input.runningIds.has(session.id) || foot?.state === "running"
    const settled = input.settledIds.has(session.id)
    const errored = foot?.state === "error"
    const stale = !running && now - lastActiveAt >= STALE_SESSION_MS
    const status: ArchiveRowStatus = running
      ? "running"
      : errored
        ? "error"
        : settled
          ? "settled"
          : "idle"

    rows.push({
      id: session.id,
      cwd: session.cwd ?? "",
      title: session.sessionName?.trim() || input.untitledLabel,
      provider: foot?.model?.provider,
      model: foot?.model?.id,
      messageCount: foot?.messageCount ?? 0,
      createdAt: session.createdAt,
      lastActiveAt,
      archivedAt,
      running,
      settled,
      errored,
      stale,
      status,
    })
  }

  return rows.sort((a, b) =>
    input.tab === "archived"
      ? (b.archivedAt ?? 0) - (a.archivedAt ?? 0) || b.lastActiveAt - a.lastActiveAt
      : b.lastActiveAt - a.lastActiveAt,
  )
}

export function filterArchiveRows(
  rows: readonly ArchiveSessionRow[],
  cwdFilter: string,
  query: string,
): ArchiveSessionRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (cwdFilter && row.cwd !== cwdFilter) return false

    if (!needle) return true
    return (
      row.title.toLowerCase().includes(needle) ||
      (row.model?.toLowerCase().includes(needle) ?? false) ||
      (row.provider?.toLowerCase().includes(needle) ?? false)
    )
  })
}

export function groupArchiveRows(
  rows: readonly ArchiveSessionRow[],
  projectByCwd: ReadonlyMap<string, ArchiveProjectView>,
): ArchiveProjectGroup[] {
  const map = new Map<string, ArchiveSessionRow[]>()

  for (const row of rows) {
    const bucket = map.get(row.cwd)

    if (bucket) bucket.push(row)
    else map.set(row.cwd, [row])
  }

  const groups: ArchiveProjectGroup[] = []

  for (const [cwd, groupRows] of map) {
    const project = projectByCwd.get(cwd) ?? fallbackProjectView(cwd)
    const staleIds = groupRows.filter((row) => row.stale).map((row) => row.id)
    const selectableIds = groupRows.filter((row) => !row.running).map((row) => row.id)

    groups.push({ project, rows: groupRows, staleIds, selectableIds })
  }

  return groups
}

export function flattenArchiveGroups(groups: readonly ArchiveProjectGroup[]): ArchiveVirtualItem[] {
  const items: ArchiveVirtualItem[] = []

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]!

    if (group.rows.length === 0) continue

    items.push({
      kind: "group-head",
      key: `head:${group.project.cwd}`,
      group,
      firstGroup: groupIndex === 0,
    })

    for (let i = 0; i < group.rows.length; i += 1) {
      const row = group.rows[i]!

      items.push({
        kind: "row",
        key: row.id,
        row,
        isFirst: i === 0,
        isLast: i === group.rows.length - 1,
      })
    }
  }

  return items
}

export function archiveVirtualItemHeight(item: ArchiveVirtualItem | undefined): number {
  if (!item) return ARCHIVE_ROW_HEIGHT

  if (item.kind === "group-head")
    return item.firstGroup ? ARCHIVE_GROUP_HEAD_FIRST_HEIGHT : ARCHIVE_GROUP_HEAD_HEIGHT
  return ARCHIVE_ROW_HEIGHT
}

export function idsMatchingQuickRule(
  rows: readonly ArchiveSessionRow[],
  rule: ArchiveQuickRule,
): string[] {
  return rows
    .filter((row) => {
      if (row.running) return false

      if (rule === "stale") return row.stale

      if (rule === "settled") return row.settled
      return row.errored
    })
    .map((row) => row.id)
}

export function collectProjectOptions(
  sessions: readonly SessionMetadata[],
  projectByCwd: ReadonlyMap<string, ArchiveProjectView>,
): ArchiveProjectView[] {
  const seen = new Set<string>()
  const options: ArchiveProjectView[] = []

  for (const session of sessions) {
    if (!session.cwd || seen.has(session.cwd)) continue
    seen.add(session.cwd)
    options.push(projectByCwd.get(session.cwd) ?? fallbackProjectView(session.cwd))
  }

  return options.sort((a, b) => a.name.localeCompare(b.name))
}

export interface AgeTranslator {
  (key: string, params?: Record<string, string | number>): string
}

export function formatRelativeAge(ts: number, now: number, t: AgeTranslator): string {
  const diffMs = Math.max(0, now - ts)
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return t("settings.archive.justNow")

  if (minutes < 60) return t("settings.archive.minutesAgo", { count: minutes })
  const hours = Math.floor(minutes / 60)

  if (hours < 24) return t("settings.archive.hoursAgo", { count: hours })
  const days = Math.floor(hours / 24)

  if (days < 14) return t("settings.archive.daysAgo", { count: days })
  const weeks = Math.floor(days / 7)

  if (days < 60) return t("settings.archive.weeksAgo", { count: weeks })
  const months = Math.max(2, Math.floor(days / 30))
  return t("settings.archive.monthsAgo", { count: months })
}
