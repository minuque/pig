import { computed, onBeforeUnmount, shallowRef, watch, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/lib/transcript-rows.js"
import {
  deriveTranscriptMinimapItems,
  resolveMinimapAnchorPercent,
  resolveMinimapHitStripWidth,
  resolveMinimapTopPercent,
  sameIdList,
  sameNumberList,
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
  const anchorTops = shallowRef<readonly number[]>([])
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )

  function collectLayout(
    port: HTMLElement | null,
    column: HTMLElement | null,
  ): { inViewIds: string[]; anchorTops: number[] } {
    const ids = items.value.map((item) => item.id)
    const fallback = ids.map((_, index) => resolveMinimapTopPercent(index, ids.length))
    if (!port || ids.length === 0) return { inViewIds: [], anchorTops: fallback }
    const box = port.getBoundingClientRect()
    const body =
      column?.firstElementChild instanceof HTMLElement ? column.firstElementChild : column
    const bodyBox = body?.getBoundingClientRect()
    const total = body?.offsetHeight ?? 0
    const inView: string[] = []
    const byId = new Map<string, number>()
    for (const el of port.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      const row = el.getBoundingClientRect()
      const id = el.dataset.minimapRow
      if (!id) continue
      if (!(row.bottom <= box.top || row.top >= box.bottom)) inView.push(id)
      const offset = bodyBox ? row.top - bodyBox.top : row.top - box.top + port.scrollTop
      byId.set(id, resolveMinimapAnchorPercent(offset, total))
    }
    return {
      inViewIds: inView,
      anchorTops:
        total <= 0 ? fallback : ids.map((id, index) => byId.get(id) ?? fallback[index] ?? 0),
    }
  }

  function syncLayout(port: HTMLElement | null, column: HTMLElement | null) {
    viewportWidth.value = port?.clientWidth ?? 0
    contentWidth.value = column?.offsetWidth ?? 0
    const next = collectLayout(port, column)
    if (!sameIdList(inViewIds.value, next.inViewIds)) inViewIds.value = next.inViewIds
    if (!sameNumberList(anchorTops.value, next.anchorTops)) anchorTops.value = next.anchorTops
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

  return { items, inViewIds, anchorTops, hitStripWidth, syncLayout }
}
