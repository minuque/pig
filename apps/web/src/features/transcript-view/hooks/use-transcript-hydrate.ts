import { nextTick, onBeforeUnmount, shallowRef, watch, type Ref } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import { nextHydrateId } from "@features/transcript-view/lib/transcript-hydrate.js"
import { yieldToMain } from "@features/transcript-view/lib/yield-to-main.js"

/** 首帧之后一次只挂一条可见助手 Markdown，滚动中停。 */
export function useTranscriptHydrate(
  rows: Ref<readonly TimelineRow[]>,
  scrollIdle: Ref<boolean>,
  getViewport: () => HTMLElement | null,
) {
  const hydrated = shallowRef(new Set<string>())
  const inView = shallowRef(new Set<string>())
  let observer: IntersectionObserver | undefined
  let pumping = false
  let generation = 0

  function mark(id: string) {
    if (hydrated.value.has(id)) return
    const next = new Set(hydrated.value)
    next.add(id)
    hydrated.value = next
  }

  function markStreaming() {
    for (const row of rows.value) {
      if (row.role === "assistant" && row.streaming) mark(row.id)
    }
  }

  function isHydrated(id: string) {
    return hydrated.value.has(id)
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
        const id = nextHydrateId(rows.value, hydrated.value, inView.value, scrollIdle.value)

        if (!id) break
        mark(id)
        await yieldToMain()
      }
    } finally {
      if (mine === generation) pumping = false
    }
  }

  watch([rows, scrollIdle, inView], () => {
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
    observer?.disconnect()
  })
  return { isHydrated, observe }
}
