import type { TimelineRow, TimelineTurn } from "@features/transcript-view/type.js"
import { reuseTimelineRows } from "@features/transcript-view/lib/transcript-rows.js"

/** 按 user 行切开；无 user 前缀单独成一轮。不改传入的 rows 数组。 */
export function groupTimelineTurns(rows: readonly TimelineRow[]): TimelineTurn[] {
  const turns: TimelineTurn[] = []

  for (const row of rows) {
    const last = turns.at(-1)

    if (!last || row.role === "user") {
      turns.push({
        id: row.role === "user" ? row.id : `orphan:${row.id}`,
        rows: [row],
      })
    } else last.rows.push(row)
  }

  return turns
}

/** 轮对象可复用时保持同一引用；轮内行走 reuseTimelineRows。 */
export function reuseTimelineTurns(
  previous: readonly TimelineTurn[],
  next: readonly TimelineTurn[],
): TimelineTurn[] {
  if (previous.length === 0) return next as TimelineTurn[]
  const prevById = new Map(previous.map((turn) => [turn.id, turn]))
  let changed = previous.length !== next.length
  const turns = next.map((turn, index) => {
    const prev = prevById.get(turn.id)
    const rows = prev ? reuseTimelineRows(prev.rows, turn.rows) : turn.rows
    const reused = prev && prev.rows === rows ? prev : { id: turn.id, rows }

    if (reused !== previous[index]) changed = true
    return reused
  })
  return changed ? turns : (previous as TimelineTurn[])
}
