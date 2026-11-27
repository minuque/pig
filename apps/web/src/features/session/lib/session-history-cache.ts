import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/common-type.js"

export const SESSION_VIEW_CACHE = 5

export type SessionHistoryPage = {
  items: TranscriptItem[]
  disk: TranscriptItem[]
  timings: TurnTiming[]
  hasMore: boolean
  version?: string | undefined
  externalTurn: boolean
  heldLive: TranscriptItem[]
  ready: boolean
  stale: boolean
  failed: boolean
}

export function emptyHistoryPage(): SessionHistoryPage {
  return {
    items: [],
    disk: [],
    timings: [],
    hasMore: false,
    externalTurn: false,
    heldLive: [],
    ready: false,
    stale: false,
    failed: false,
  }
}

export function createSessionHistoryCache(max = SESSION_VIEW_CACHE) {
  const pages = new Map<string, SessionHistoryPage>()
  const order: string[] = []

  function touch(id: string) {
    const at = order.indexOf(id)

    if (at >= 0) order.splice(at, 1)
    order.push(id)
  }

  function evict() {
    while (order.length > max) {
      const oldest = order[0]

      if (!oldest) break
      order.shift()
      pages.delete(oldest)
    }
  }

  function peek(id: string): SessionHistoryPage | undefined {
    return pages.get(id)
  }

  function isReady(id: string) {
    return pages.get(id)?.ready === true
  }

  function isFresh(id: string) {
    const page = pages.get(id)
    return page?.ready === true && !page.stale
  }

  function write(id: string, patch: Partial<SessionHistoryPage>) {
    const prev = pages.get(id) ?? emptyHistoryPage()
    pages.set(id, { ...prev, ...patch })
    touch(id)
    evict()
  }

  return { peek, isReady, isFresh, write, touch }
}
