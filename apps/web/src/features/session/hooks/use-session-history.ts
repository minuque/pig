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

export function createHistoryStore() {
  const cache = createSessionHistoryCache()
  const version = shallowRef(0)
  const requestById = new Map<string, number>()
  const inflight = new Map<string, Promise<void>>()
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
    cache.write(id, { heldLive: [...live] })
    bump()
  }

  function releaseLive(id: string) {
    const page = cache.peek(id)

    if (!page?.heldLive.length) return
    cache.write(id, { heldLive: [], stale: true })
    bump()
  }

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

  function refreshHistory(id: string) {
    return inflight.get(id) ?? loadHistory(id, { force: true })
  }

  function timelineSource(
    id: string | undefined,
  ): Pick<TimelineInput, "persisted" | "liveOverlay"> {
    void version.value
    const page = id ? cache.peek(id) : undefined
    return { persisted: page?.items ?? [], liveOverlay: page?.heldLive ?? [] }
  }

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
