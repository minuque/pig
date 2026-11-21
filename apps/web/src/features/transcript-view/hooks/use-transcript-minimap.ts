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
  const currentId = shallowRef<string | null>(null)
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )
  let sizeObserver: ResizeObserver | undefined
  let rowObserver: IntersectionObserver | undefined
  const visibleIds = new Set<string>()
  const aboveIds = new Set<string>()
  const observedRows = new Map<string, Element>()

  function publish() {
    const keys = toValue(mountedKeys)
    const next = keys.filter((key) => visibleIds.has(key))
    let current = next[0]

    if (!current) {
      for (let index = keys.length - 1; index >= 0; index -= 1) {
        const key = keys[index]!

        if (aboveIds.has(key)) {
          current = key
          break
        }
      }
    }

    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next

    const resolved = current ?? currentId.value

    if (resolved !== currentId.value) currentId.value = resolved
  }

  function onRowIntersect(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.minimapRow

      if (!id) continue

      if (entry.isIntersecting) {
        visibleIds.add(id)
        aboveIds.delete(id)
        continue
      }

      visibleIds.delete(id)

      if (entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0)) aboveIds.add(id)
      else aboveIds.delete(id)
    }

    publish()
  }

  function observeRows() {
    const port = toValue(layout.viewport)
    const observer = rowObserver

    if (!port || !observer) return

    const seen = new Set<string>()

    for (const el of port.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
      const id = el.dataset.minimapRow

      if (!id) continue
      seen.add(id)

      if (observedRows.get(id) === el) continue
      observedRows.set(id, el)
      visibleIds.delete(id)
      aboveIds.delete(id)
      observer.observe(el)
    }

    for (const [id, el] of observedRows) {
      if (seen.has(id)) continue
      observer.unobserve(el)
      observedRows.delete(id)
      visibleIds.delete(id)
      aboveIds.delete(id)
    }

    publish()
  }

  function applySize(target: Element, width: number) {
    const next = Math.round(width)
    const port = toValue(layout.viewport)
    const column = toValue(layout.column)

    if (target === port && viewportWidth.value !== next) viewportWidth.value = next

    if (target === column && contentWidth.value !== next) contentWidth.value = next
  }

  watch(
    () => [toValue(layout.viewport), toValue(layout.column)] as const,
    ([port, column]) => {
      sizeObserver?.disconnect()
      sizeObserver = undefined
      rowObserver?.disconnect()
      rowObserver = undefined
      observedRows.clear()
      visibleIds.clear()
      aboveIds.clear()

      if (!port) {
        viewportWidth.value = 0
        contentWidth.value = 0
        publish()
        return
      }

      rowObserver = new IntersectionObserver(onRowIntersect, { root: port })

      sizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentBoxSize?.[0]
          const width = box?.inlineSize ?? entry.contentRect.width
          applySize(entry.target, width)
        }
      })
      sizeObserver.observe(port)

      if (column) sizeObserver.observe(column)
      void nextTick(observeRows)
    },
    { flush: "post" },
  )

  watch(
    () => toValue(mountedKeys).join("\0"),
    () => {
      void nextTick(observeRows)
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => {
    sizeObserver?.disconnect()
    rowObserver?.disconnect()
  })
  return { items, inViewIds, currentId, hitStripWidth }
}
