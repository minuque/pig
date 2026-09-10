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

/** 更长列表的前缀是新历史，prev 仍作为后缀出现。 */
export function historyPrepended(
  prev: readonly { readonly id: string }[],
  next: readonly { readonly id: string }[],
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false
  const offset = next.length - prev.length
  for (let i = 0; i < prev.length; i += 1) {
    if (next[offset + i]?.id !== prev[i]?.id) return false
  }
  return true
}

/** 历史从前面插入时，贴底则切到最后一轮；上翻保持当前窗口。 */
export function recutWindowStartOnPrepend(
  prev: readonly TimelineRow[],
  next: readonly TimelineRow[],
  currentStart: number,
  atTail: boolean,
): number {
  if (atTail && historyPrepended(prev, next)) return lastTurnStartIndex(next)
  if (currentStart > next.length) return lastTurnStartIndex(next)
  return currentStart
}
