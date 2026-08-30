import { computed, onBeforeUnmount, shallowRef, watch, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/lib/transcript-rows.js"
import {
  deriveTranscriptMinimapItems,
  resolveMinimapHitStripWidth,
  sameIdList,
} from "@features/transcript-view/lib/transcript-minimap.js"

/** minimap 几何与输入遮罩、贴底 observer 都停在 Transcript 内部。 */
export function useTranscriptMinimap(
  rows: MaybeRefOrGetter<readonly TimelineRow[]>,
  layout: {
    region: MaybeRefOrGetter<HTMLElement | null>
    viewport: MaybeRefOrGetter<HTMLElement | null>
    inputBar: MaybeRefOrGetter<HTMLElement | null>
    scrollRoot: () => HTMLElement | null
    sidebarResizing: MaybeRefOrGetter<boolean>
    atBottom: MaybeRefOrGetter<boolean>
    stickToBottom: () => void
  },
) {
  const viewportWidth = shallowRef(0)
  const contentWidth = shallowRef(0)
  const inViewIds = shallowRef<readonly string[]>([])
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )

  function collectInViewIds(region: HTMLElement | null): string[] {
    if (!region) return []
    const viewport = region.getBoundingClientRect()
    const ids: string[] = []
    for (const el of region.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      const box = el.getBoundingClientRect()
      if (box.bottom <= viewport.top || box.top >= viewport.bottom) continue
      const id = el.dataset.minimapRow
      if (id) ids.push(id)
    }
    return ids
  }

  function syncLayout(region: HTMLElement | null, scroller: HTMLElement | null) {
    viewportWidth.value = region?.clientWidth ?? 0
    contentWidth.value = scroller?.offsetWidth ?? 0
    const next = collectInViewIds(region)
    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next
  }

  function tick() {
    const el = toValue(layout.region)
    const bar = toValue(layout.inputBar)
    const host = toValue(layout.viewport)
    const root = layout.scrollRoot()
    syncLayout(el, root)
    if (bar && host) host.style.setProperty("--chat-input-overlay", `${bar.offsetHeight}px`)
    if (toValue(layout.sidebarResizing) || !toValue(layout.atBottom)) return
    layout.stickToBottom()
  }

  let layoutObserver: ResizeObserver | undefined
  watch(
    () => [toValue(layout.region), toValue(layout.inputBar)] as const,
    ([el, bar]) => {
      layoutObserver?.disconnect()
      layoutObserver = undefined
      if (!el) return
      layoutObserver = new ResizeObserver(tick)
      layoutObserver.observe(el)
      if (bar) layoutObserver.observe(bar)
      tick()
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => layoutObserver?.disconnect())

  return { items, inViewIds, hitStripWidth, syncLayout }
}
