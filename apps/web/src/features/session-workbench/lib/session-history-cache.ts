import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"

/** 切走的会话历史留着，切回立刻能画。 */
export const SESSION_VIEW_CACHE = 5

/** items 是已加载窗口（只增不缩）；heldLive 是本次连接的 live 覆盖；stale 表示连接断过，下次要重拉。 */
export type SessionHistoryPage = {
  items: TranscriptItem[]
  timings: TurnTiming[]
  hasMore: boolean
  heldLive: TranscriptItem[]
  ready: boolean
  stale: boolean
}

export function emptyHistoryPage(): SessionHistoryPage {
  return { items: [], timings: [], hasMore: false, heldLive: [], ready: false, stale: false }
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
