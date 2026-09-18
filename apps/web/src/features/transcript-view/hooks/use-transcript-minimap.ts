import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
  toValue,
} from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  deriveTranscriptMinimapItems,
  resolveMinimapHitStripWidth,
  sameIdList,
} from "@features/transcript-view/lib/transcript-minimap.js"

export function useTranscriptMinimap(
  rows: MaybeRefOrGetter<readonly TimelineRow[]>,
  layout: {
    viewport: MaybeRefOrGetter<HTMLElement | null>
    column: MaybeRefOrGetter<HTMLElement | null>
  },
  mountedKeys: MaybeRefOrGetter<readonly string[]>,
) {
  const viewportWidth = shallowRef(0)
  const contentWidth = shallowRef(0)
  const inViewIds = shallowRef<readonly string[]>([])
  const visible = new Set<string>()
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )
  let inViewObserver: IntersectionObserver | undefined
  let sizeObserver: ResizeObserver | undefined

  function publishInView() {
    const next = toValue(rows)
      .filter((row) => row.role === "user" && visible.has(row.id))
      .map((row) => row.id)

    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next
  }

  function onIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.minimapRow

      if (!id) continue

      if (entry.isIntersecting) visible.add(id)
      else visible.delete(id)
    }

    publishInView()
  }

  function applySize(target: Element, width: number) {
    const next = Math.round(width)
    const port = toValue(layout.viewport)
    const column = toValue(layout.column)

    if (target === port && viewportWidth.value !== next) viewportWidth.value = next

    if (target === column && contentWidth.value !== next) contentWidth.value = next
  }

  function observeInView() {
    inViewObserver?.disconnect()
    inViewObserver = undefined
    visible.clear()
    const port = toValue(layout.viewport)

    if (!port) {
      publishInView()
      return
    }

    inViewObserver = new IntersectionObserver(onIntersect, { root: port, threshold: 0 })

    for (const el of port.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      inViewObserver.observe(el)
    }
  }

  watch(
    () => [toValue(layout.viewport), toValue(layout.column)] as const,
    ([port, column]) => {
      sizeObserver?.disconnect()
      sizeObserver = undefined

      if (!port) {
        viewportWidth.value = 0
        contentWidth.value = 0
        return
      }

      sizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentBoxSize?.[0]
          const width = box?.inlineSize ?? entry.contentRect.width
          applySize(entry.target, width)
        }
      })
      sizeObserver.observe(port)

      if (column) sizeObserver.observe(column)
    },
    { flush: "post" },
  )

  watch(
    () => [toValue(layout.viewport), toValue(mountedKeys).join("\0")] as const,
    () => {
      void nextTick(observeInView)
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => {
    inViewObserver?.disconnect()
    sizeObserver?.disconnect()
  })
  return { items, inViewIds, hitStripWidth }
}
