import type { TimelineRow } from "@features/transcript-view/type.js"

export const TRANSCRIPT_ROW_FALLBACK_HEIGHT = 160
export const TRANSCRIPT_WINDOW_OVERSCAN = 4

export type TranscriptWindowSlice = {
  start: number
  end: number
  padTop: number
  padBottom: number
}

/** 最后 turnCount 条用户句中最早一条的下标；不足则 0。 */
export function lastTurnStartIndex(rows: readonly TimelineRow[], turnCount = 4): number {
  let left = turnCount
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.role !== "user") continue
    left -= 1
    if (left === 0) return i
  }
  return 0
}

export function transcriptRowGapClass(index: number, rows: readonly TimelineRow[]): string {
  if (index <= 0) return ""
  if (rows[index]?.role === "user") return "row-gap-user"
  if (rows[index - 1]?.role === "user") return "row-gap-turn"
  return "row-gap"
}

function slotHeight(heights: readonly number[], index: number, fallback: number): number {
  const height = heights[index] ?? 0
  return height > 0 ? height : fallback
}

function padRange(heights: readonly number[], from: number, to: number, fallback: number): number {
  let total = 0
  for (let i = from; i < to; i += 1) total += slotHeight(heights, i, fallback)
  return total
}

/** 按滚动位置切视口窗口；heights 全空或全 0 时挂全量。 */
export function resolveTranscriptWindow(
  heights: readonly number[],
  scrollTop: number,
  clientHeight: number,
  overscan: number,
  fallbackHeight = TRANSCRIPT_ROW_FALLBACK_HEIGHT,
): TranscriptWindowSlice {
  const count = heights.length
  if (count === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 }
  if (clientHeight <= 0 || !heights.some((height) => height > 0)) {
    return { start: 0, end: count, padTop: 0, padBottom: 0 }
  }

  const viewTop = Math.max(0, scrollTop)
  const viewBottom = viewTop + clientHeight
  const extra = Math.max(0, Math.floor(overscan))

  let start = 0
  let offset = 0
  while (start < count) {
    const next = offset + slotHeight(heights, start, fallbackHeight)
    if (next > viewTop) break
    offset = next
    start += 1
  }

  let end = start
  let cursor = offset
  while (end < count && (end === start || cursor < viewBottom)) {
    cursor += slotHeight(heights, end, fallbackHeight)
    end += 1
  }

  start = Math.max(0, start - extra)
  end = Math.min(count, end + extra)

  return {
    start,
    end,
    padTop: padRange(heights, 0, start, fallbackHeight),
    padBottom: padRange(heights, end, count, fallbackHeight),
  }
}

export function extendWindowToTail(
  slice: TranscriptWindowSlice,
  count: number,
): TranscriptWindowSlice {
  if (slice.end >= count) return slice
  return { start: slice.start, end: count, padTop: slice.padTop, padBottom: 0 }
}
