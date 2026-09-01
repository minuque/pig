import { computed, onBeforeUnmount, shallowRef, watch, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/lib/transcript-rows.js"
import {
  deriveTranscriptMinimapItems,
  resolveMinimapHitStripWidth,
  sameIdList,
} from "@features/transcript-view/lib/transcript-minimap.js"

/** 可视区几何取滚动层，正文宽取内容列。 */
export function useTranscriptMinimap(
  rows: MaybeRefOrGetter<readonly TimelineRow[]>,
  layout: {
    viewport: MaybeRefOrGetter<HTMLElement | null>
    inputBar: MaybeRefOrGetter<HTMLElement | null>
    column: MaybeRefOrGetter<HTMLElement | null>
  },
) {
  const viewportWidth = shallowRef(0)
  const contentWidth = shallowRef(0)
  const inViewIds = shallowRef<readonly string[]>([])
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )

  function collectInViewIds(port: HTMLElement | null): string[] {
    if (!port) return []
    const box = port.getBoundingClientRect()
    const ids: string[] = []
    for (const el of port.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      const row = el.getBoundingClientRect()
      if (row.bottom <= box.top || row.top >= box.bottom) continue
      const id = el.dataset.minimapRow
      if (id) ids.push(id)
    }
    return ids
  }

  function syncLayout(port: HTMLElement | null, column: HTMLElement | null) {
    viewportWidth.value = port?.clientWidth ?? 0
    contentWidth.value = column?.offsetWidth ?? 0
    const next = collectInViewIds(port)
    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next
  }

  function tick() {
    const bar = toValue(layout.inputBar)
    const host = toValue(layout.viewport)
    syncLayout(host, toValue(layout.column))
    if (bar && host) {
      const inner = bar.firstElementChild
      const height = inner instanceof HTMLElement ? inner.offsetHeight : bar.scrollHeight
      host.style.setProperty("--size-chat-input-overlay", `${height}px`)
    }
  }

  let layoutObserver: ResizeObserver | undefined
  watch(
    () => [toValue(layout.viewport), toValue(layout.inputBar), toValue(layout.column)] as const,
    ([el, bar, column]) => {
      layoutObserver?.disconnect()
      layoutObserver = undefined
      if (!el) return
      layoutObserver = new ResizeObserver(tick)
      layoutObserver.observe(el)
      if (bar) layoutObserver.observe(bar)
      if (column) layoutObserver.observe(column)
      tick()
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => layoutObserver?.disconnect())

  return { items, inViewIds, hitStripWidth, syncLayout }
}
