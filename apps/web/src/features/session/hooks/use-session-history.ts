import { computed, shallowReactive, shallowRef } from "vue"
import type { TranscriptItem } from "@/types/common-type.js"
import { notifyAction } from "@components/layout/notify.js"
import { errorMessage } from "@client/http.js"
import { t } from "@i18n/index.js"
import { sessionTranscript } from "@client/platform.js"
import {
  absorbTranscriptPage,
  NO_TOOL_STARTS,
  projectTranscriptTimeline,
  type TimelineInput,
} from "@features/session/lib/transcript-timeline.js"
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

  /** live 覆盖就是本次连接收到的最新条目（按 id 去重后由订阅方给出），对齐与回填交给投影。 */
  function overlayLive(id: string, live: readonly TranscriptItem[]) {
    if (live.length === 0) return
    cache.write(id, { heldLive: [...live] })
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
        const cached = cache.peek(id)
        const known = cached?.ready ? cached.version : undefined
        const disk = cached?.disk ?? []
        const last = disk.at(-1)
        const after = last ? `${disk.length}:${last.id}` : undefined
        const result = await sessionTranscript(id, { known, after })

        if (requestById.get(id) !== request) return

        if ("unchanged" in result) {
          cache.write(id, { stale: false })
          return
        }

        const { timings, hasMore, version: fileVersion, externalTurn } = result
        // 尾巴接回请求时的基准，得到的就是网关此刻的全文
        const items = "append" in result ? [...disk, ...result.append] : result.items
        const absorbed = absorbTranscriptPage(cache.peek(id), { items, timings, hasMore })
        cache.write(id, {
          ...absorbed,
          disk: items,
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

  /** watch 事件与重连补拉用：已有请求在飞就等它落地，不另发。 */
  function refreshHistory(id: string) {
    return inflight.get(id) ?? loadHistory(id, { force: true })
  }

  /** 时间线投影的底稿：磁盘窗口与 live 覆盖分开交出去，合并规则只在纯函数里。 */
  function timelineSource(
    id: string | undefined,
  ): Pick<TimelineInput, "persisted" | "liveOverlay"> {
    void version.value
    const page = id ? cache.peek(id) : undefined
    return { persisted: page?.items ?? [], liveOverlay: page?.heldLive ?? [] }
  }

  /** 指定会话当前的转录（磁盘 + live 对齐）；后台泵队与发送锚点用，不带客户端暂存。 */
  function transcriptFor(id: string): readonly TranscriptItem[] {
    return projectTranscriptTimeline({
      ...timelineSource(id),
      optimisticSends: [],
      turnPending: false,
      toolStartedAt: NO_TOOL_STARTS,
    })
  }

  return {
    version,
    show,
    overlayLive,
    releaseLive,
    timelineSource,
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
    timelineSource: store.timelineSource,
    transcriptFor,
    isFresh: store.isFresh,
    loadHistory: store.loadHistory,
    refreshHistory: store.refreshHistory,
  }
}
