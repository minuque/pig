import { computed, shallowRef } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import { sessionTranscript } from "@client/platform.js"
import {
  absorbLatestTranscriptPage,
  mergeLiveTranscript,
} from "@features/session-workbench/lib/session-state.js"
import { createSessionHistoryCache } from "@features/session-workbench/lib/session-history-cache.js"

/** HTTP 历史按 Session 留最近几份；切走不清掉，切回立刻能画。 */
export function useSessionHistory() {
  const cache = createSessionHistoryCache()
  const activeId = shallowRef<string>()
  const version = shallowRef(0)
  const loadingOlder = shallowRef(false)
  const requestById = new Map<string, number>()
  let olderRequest = 0

  function bump() {
    version.value += 1
  }

  function setActive(id: string | undefined) {
    activeId.value = id

    if (id) cache.touch(id)
  }

  function overlayLive(id: string, live: readonly TranscriptItem[]) {
    if (live.length === 0) return
    const page = cache.peek(id)
    cache.write(id, {
      heldLive: mergeLiveTranscript(page?.heldLive ?? [], live),
    })
    bump()
  }

  /** 打开拉最后一轮；之后把最新页吸收进已加载窗口。 */
  async function loadHistory(id: string) {
    const request = (requestById.get(id) ?? 0) + 1
    requestById.set(id, request)

    if (activeId.value === id) {
      olderRequest += 1
      loadingOlder.value = false
    }

    try {
      const { items, timings, hasMore } = await sessionTranscript(id)

      if (requestById.get(id) !== request) return

      const absorbed = absorbLatestTranscriptPage(cache.peek(id), { items, timings, hasMore })

      cache.write(id, { ...absorbed, ready: true })
      bump()
    } catch {
      if (requestById.get(id) !== request) return

      if (!cache.isReady(id)) {
        cache.write(id, { items: [], timings: [], hasMore: false, ready: true })
        bump()
      }
    }
  }

  async function loadOlderHistory() {
    const id = activeId.value
    const page = id ? cache.peek(id) : undefined
    const before = page?.items[0]?.id

    if (!id || !before || !page?.hasMore || loadingOlder.value) return
    const request = ++olderRequest
    loadingOlder.value = true

    try {
      const { items, timings, hasMore } = await sessionTranscript(id, before)

      if (request !== olderRequest || activeId.value !== id) return
      const current = cache.peek(id)

      if (!current) return
      const known = new Set(current.items.map((item) => item.id))
      const older = items.filter((item) => !known.has(item.id))

      if (older.length > 0) {
        const seen = new Set(current.timings.map((item) => item.userId))
        cache.write(id, {
          items: older.concat(current.items),
          timings: current.timings.concat(timings.filter((item) => !seen.has(item.userId))),
          hasMore,
        })
        bump()
      } else {
        cache.write(id, { hasMore })
        bump()
      }
    } catch {
      if (request !== olderRequest || activeId.value !== id) return
    } finally {
      if (request === olderRequest) loadingOlder.value = false
    }
  }

  const liveTranscript = computed(() => {
    const id = activeId.value
    const rev = version.value

    if (!id || rev < 0) return []
    const page = cache.peek(id)
    return page ? mergeLiveTranscript(page.items, page.heldLive) : []
  })

  const historyReadyId = computed(() => {
    const id = activeId.value
    const rev = version.value

    if (!id || rev < 0 || !cache.isReady(id)) return undefined
    return id
  })

  const historyHasMore = computed(() => {
    const id = activeId.value
    const rev = version.value

    if (!id || rev < 0) return false
    return cache.peek(id)?.hasMore ?? false
  })

  const turnTimings = computed(() => {
    const id = activeId.value
    const rev = version.value

    if (!id || rev < 0 || !cache.isReady(id)) return []
    return cache.peek(id)?.timings ?? []
  })
  return {
    activeId,
    liveTranscript,
    historyReadyId,
    historyHasMore,
    loadingOlder,
    turnTimings,
    setActive,
    overlayLive,
    loadHistory,
    loadOlderHistory,
  }
}
