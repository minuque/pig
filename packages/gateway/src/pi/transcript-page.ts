import type { TranscriptItem } from "@earendil-works/pi-protocol"
import type { TurnTiming } from "./turn-timing.js"

/** 打开会话只吐最后一轮，上翻再要更早。 */
export const TRANSCRIPT_PAGE_TURNS = 1

/** 从 before 之前（或全文末尾）往回取一轮用户句及其后内容。 */
export function pageTranscriptItems(
  items: readonly TranscriptItem[],
  options: { before?: string } = {},
): { items: TranscriptItem[]; hasMore: boolean } {
  let end = items.length
  if (options.before) {
    const at = items.findIndex((item) => item.id === options.before)
    if (at <= 0) return { items: [], hasMore: false }
    end = at
  }
  const prefix = items.slice(0, end)
  let remaining = TRANSCRIPT_PAGE_TURNS
  let start = 0
  for (let i = prefix.length - 1; i >= 0; i -= 1) {
    if (prefix[i]?.role !== "user") continue
    remaining -= 1
    if (remaining === 0) {
      start = i
      break
    }
  }
  return { items: prefix.slice(start), hasMore: start > 0 }
}

export function pageTurnTimings(
  timings: readonly TurnTiming[],
  items: readonly TranscriptItem[],
): TurnTiming[] {
  const users = new Set(items.filter((item) => item.role === "user").map((item) => item.id))
  return timings.filter((timing) => users.has(timing.userId))
}
