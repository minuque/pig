import type { TimelineRow } from "@features/transcript-view/type.js"

/** 最后 turnCount 条用户句中最早一条的下标；不足则 0。首屏默认 1 轮。 */
export function lastTurnStartIndex(rows: readonly TimelineRow[], turnCount = 1): number {
  let left = turnCount
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.role !== "user") continue
    left -= 1
    if (left === 0) return i
  }
  return 0
}
