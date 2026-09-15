import { nextTick, onBeforeUnmount, shallowRef, watch, type Ref } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import { nextHydrateId, nextRichId } from "@features/transcript-view/lib/transcript-hydrate.js"
import {
  inputPending,
  yieldToBackground,
  yieldToMain,
} from "@features/transcript-view/lib/yield-to-main.js"

const OPEN_HOLD_MS = 150

/** 揭开后先挂轻量 Markdown；停稳再上 infographic。滚动中保持纯文本。 */
export function useTranscriptHydrate(
  rows: Ref<readonly TimelineRow[]>,
  scrollIdle: Ref<boolean>,
  getViewport: () => HTMLElement | null,
  readyFrame: Ref<boolean>,
) {
  const hydrated = shallowRef(new Set<string>())
  const rich = shallowRef(new Set<string>())
  const inView = shallowRef(new Set<string>())
  const openedQuiet = shallowRef(false)
  let observer: IntersectionObserver | undefined
  let pumping = false
  let generation = 0
  let holdTimer = 0

  function add(bucket: typeof hydrated, id: string) {
    if (bucket.value.has(id)) return
    const next = new Set(bucket.value)
    next.add(id)
    bucket.value = next
  }

  function markStreaming() {
    for (const row of rows.value) {
      if (row.role !== "assistant" || !row.streaming) continue
      add(hydrated, row.id)
      add(rich, row.id)
    }
  }

  function isHydrated(id: string) {
    return hydrated.value.has(id)
  }

  function isRich(id: string) {
    return rich.value.has(id)
  }

  function peekLight(): string | undefined {
    if (!readyFrame.value || !openedQuiet.value) return undefined
    return nextHydrateId(
      rows.value,
      hydrated.value,
      inView.value,
      scrollIdle.value,
      inputPending(),
      true,
    )
  }

  function peekRich(): string | undefined {
    if (!readyFrame.value || !openedQuiet.value) return undefined
    return nextRichId(
      rows.value,
      hydrated.value,
      rich.value,
      inView.value,
      scrollIdle.value,
      inputPending(),
      true,
    )
  }

  function peek(): { id: string; full: boolean } | undefined {
    const light = peekLight()

    if (light) return { id: light, full: false }
    const next = peekRich()

    if (next) return { id: next, full: true }
  }

  function observe() {
    observer?.disconnect()
    const root = getViewport()

    if (!root) return
    observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(inView.value)

        for (const entry of entries) {
          const id =
            entry.target instanceof HTMLElement ? entry.target.dataset.hydrateId : undefined

          if (!id) continue

          if (entry.isIntersecting) next.add(id)
          else next.delete(id)
        }

        inView.value = next
      },
      { root, threshold: 0 },
    )

    for (const node of root.querySelectorAll("[data-hydrate-id]")) observer.observe(node)
  }

  async function pump() {
    if (pumping) return
    pumping = true
    const mine = ++generation

    try {
      while (mine === generation) {
        if (!readyFrame.value || !openedQuiet.value || !scrollIdle.value) break
        const found = peek()

        if (!found) {
          if (inputPending()) {
            await yieldToBackground()
            continue
          }

          break
        }

        await yieldToBackground()

        if (mine !== generation || !readyFrame.value || !openedQuiet.value || !scrollIdle.value)
          break
        const next = peek()

        if (!next) continue

        if (next.full) add(rich, next.id)
        else add(hydrated, next.id)
        await yieldToMain()
      }
    } finally {
      if (mine === generation) pumping = false
    }
  }

  watch(
    readyFrame,
    (ready) => {
      if (holdTimer) {
        window.clearTimeout(holdTimer)
        holdTimer = 0
      }

      if (!ready) {
        openedQuiet.value = false
        return
      }

      openedQuiet.value = false
      holdTimer = window.setTimeout(() => {
        holdTimer = 0
        openedQuiet.value = true
        void pump()
      }, OPEN_HOLD_MS)
    },
    { immediate: true },
  )

  watch([rows, scrollIdle, inView, openedQuiet], () => {
    markStreaming()
    void pump()
  })

  watch(
    rows,
    () => {
      void nextTick(observe)
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => {
    generation += 1

    if (holdTimer) window.clearTimeout(holdTimer)
    observer?.disconnect()
  })
  return { isHydrated, isRich, observe }
}
