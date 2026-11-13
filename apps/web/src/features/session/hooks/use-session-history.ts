import { computed, shallowRef } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import { notifyAction } from "@components/layout/notify.js"
import { errorMessage } from "@client/http.js"
import { t } from "@i18n/index.js"
import { sessionTranscript } from "@client/platform.js"
import {
  absorbLatestTranscriptPage,
  mergeLiveTranscript,
} from "@features/session/lib/session-state.js"
import { createSessionHistoryCache } from "@features/session/lib/session-history-cache.js"

/** HTTP 历史按 Session 留最近几份；切走不清掉，切回立刻能画。 */
export function useSessionHistory() {
  const cache = createSessionHistoryCache()
  const activeId = shallowRef<string>()
  const version = shallowRef(0)
  const requestById = new Map<string, number>()
  const inflight = new Map<string, Promise<void>>()

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

  /** 连接断开：临时 id 的 live 覆盖作废，否则重连后与磁盘条目 id 对不上会重复；标记下次重拉。 */
  function releaseLive(id: string) {
    const page = cache.peek(id)

    if (!page?.heldLive.length) return
    cache.write(id, { heldLive: [], stale: true })
    bump()
  }

  /** 打开拉最后一轮；已 ready 且非 force 不发网，同 id 在飞共用请求。 */
  function loadHistory(id: string, options?: { force?: boolean }) {
    if (!options?.force && cache.isFresh(id)) return inflight.get(id) ?? Promise.resolve()
    const pending = inflight.get(id)

    if (pending && !options?.force) return pending

    const run = (async () => {
      const request = (requestById.get(id) ?? 0) + 1
      requestById.set(id, request)

      try {
        const { items, timings, hasMore } = await sessionTranscript(id)

        if (requestById.get(id) !== request) return
        const absorbed = absorbLatestTranscriptPage(cache.peek(id), { items, timings, hasMore })
        cache.write(id, { ...absorbed, ready: true, stale: false })
        bump()
      } catch (error) {
        // 失败不标 ready：不把已有会话画成欢迎页，下次打开会重拉
        if (requestById.get(id) === request && activeId.value === id) {
          notifyAction(t("session.historyFailed", { message: errorMessage(error) }))
        }
      }
    })()

    inflight.set(id, run)
    void run.finally(() => {
      if (inflight.get(id) === run) inflight.delete(id)
    })
    return run
  }

  /** 指定会话当前的合并转录（磁盘 + live 覆盖）；前台投影与后台泵队共用。 */
  function transcriptFor(id: string): readonly TranscriptItem[] {
    void version.value
    const page = cache.peek(id)
    return page ? mergeLiveTranscript(page.items, page.heldLive) : []
  }

  const liveTranscript = computed(() => {
    const id = activeId.value
    return id ? transcriptFor(id) : []
  })
  const historyReadyId = computed(() => {
    const id = activeId.value
    void version.value

    if (!id || !cache.isReady(id)) return undefined
    return id
  })
  const turnTimings = computed(() => {
    const id = activeId.value
    void version.value

    if (!id || !cache.isReady(id)) return []
    return cache.peek(id)?.timings ?? []
  })
  return {
    activeId,
    liveTranscript,
    historyReadyId,
    turnTimings,
    setActive,
    overlayLive,
    releaseLive,
    transcriptFor,
    isFresh: (id: string) => cache.isFresh(id),
    loadHistory,
  }
}
