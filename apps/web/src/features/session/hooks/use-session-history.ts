import { computed, shallowReactive, shallowRef } from "vue"
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

export type HistoryStore = ReturnType<typeof createHistoryStore>

/** HTTP 历史按 Session 留最近几份；切走不清掉，切回立刻能画。两侧 workbench 共用一份。 */
export function createHistoryStore() {
  const cache = createSessionHistoryCache()
  const version = shallowRef(0)
  const requestById = new Map<string, number>()
  const inflight = new Map<string, Promise<void>>()
  /** 每侧正在显示的会话；拉历史失败只对显示中的会话提示。 */
  const shown = shallowReactive(new Map<symbol, string>())

  function bump() {
    version.value += 1
  }

  function show(owner: symbol, id: string | undefined) {
    if (id) {
      shown.set(owner, id)
      cache.touch(id)
    } else shown.delete(owner)
  }

  const isShown = (id: string) => [...shown.values()].includes(id)

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
        const known = cache.peek(id)?.ready ? cache.peek(id)?.version : undefined
        const result = known ? await sessionTranscript(id, known) : await sessionTranscript(id)

        if (requestById.get(id) !== request) return

        if ("unchanged" in result) {
          cache.write(id, { stale: false })
          return
        }

        const { items, timings, hasMore, version: fileVersion, externalTurn } = result
        const absorbed = absorbLatestTranscriptPage(cache.peek(id), { items, timings, hasMore })
        cache.write(id, {
          ...absorbed,
          version: fileVersion,
          externalTurn,
          ready: true,
          stale: false,
        })
        bump()
      } catch (error) {
        // 失败不标 ready：不把已有会话画成欢迎页，下次打开会重拉
        if (requestById.get(id) === request && isShown(id)) {
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

  /** 轮询用：已有请求在飞就等它落地，不另发。 */
  function refreshHistory(id: string) {
    return inflight.get(id) ?? loadHistory(id, { force: true })
  }

  /** 指定会话当前的合并转录（磁盘 + live 覆盖）；前台投影与后台泵队共用。 */
  function transcriptFor(id: string): readonly TranscriptItem[] {
    void version.value
    const page = cache.peek(id)
    return page ? mergeLiveTranscript(page.items, page.heldLive) : []
  }

  return {
    version,
    show,
    overlayLive,
    releaseLive,
    transcriptFor,
    isFresh: (id: string) => cache.isFresh(id),
    isReady: (id: string) => cache.isReady(id),
    externalTurnFor: (id: string) => {
      void version.value
      return cache.peek(id)?.externalTurn ?? false
    },
    timingsFor: (id: string) => cache.peek(id)?.timings ?? [],
    loadHistory,
    refreshHistory,
  }
}

/** 一侧 workbench 看历史的窗口：当前显示哪个会话，以及它的转录与就绪状态。 */
export function useHistoryView(store: HistoryStore) {
  const owner = Symbol("history-view")
  const activeId = shallowRef<string>()
  const { version, transcriptFor } = store

  function setActive(id: string | undefined) {
    activeId.value = id
    store.show(owner, id)
  }

  const liveTranscript = computed(() => {
    const id = activeId.value
    return id ? transcriptFor(id) : []
  })
  const historyReadyId = computed(() => {
    const id = activeId.value
    void version.value

    if (!id || !store.isReady(id)) return undefined
    return id
  })
  const turnTimings = computed(() => {
    const id = activeId.value
    void version.value

    if (!id || !store.isReady(id)) return []
    return store.timingsFor(id)
  })
  const externalTurn = computed(() => {
    const id = activeId.value
    return id ? store.externalTurnFor(id) : false
  })
  return {
    activeId,
    liveTranscript,
    historyReadyId,
    turnTimings,
    externalTurn,
    setActive,
    overlayLive: store.overlayLive,
    releaseLive: store.releaseLive,
    transcriptFor,
    isFresh: store.isFresh,
    loadHistory: store.loadHistory,
    refreshHistory: store.refreshHistory,
  }
}
