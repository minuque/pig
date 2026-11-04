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
  /** 当前所在回合：可见的首条用户句；都不在视口时取刚滚过去的那条。 */
  const currentId = shallowRef<string | null>(null)
  const items = computed(() => deriveTranscriptMinimapItems(toValue(rows)))
  const hitStripWidth = computed(() =>
    resolveMinimapHitStripWidth(viewportWidth.value, contentWidth.value),
  )
  let sizeObserver: ResizeObserver | undefined
  let scrollTarget: HTMLElement | null = null
  let scrollRaf = 0

  /** 直接量挂在视口里的用户句：虚拟窗口会换行，观察器记下的可见集会过期。 */
  function publishInView() {
    const port = toValue(layout.viewport)
    const next: string[] = []
    let above: string | null = null

    if (port) {
      const box = port.getBoundingClientRect()

      for (const el of port.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
        const id = el.dataset.minimapRow

        if (!id) continue

        const rect = el.getBoundingClientRect()

        if (rect.bottom > box.top && rect.top < box.bottom) next.push(id)
        else if (rect.bottom <= box.top) above = id
      }
    }

    if (!sameIdList(inViewIds.value, next)) inViewIds.value = next

    const current = next[0] ?? above ?? currentId.value

    if (current !== currentId.value) currentId.value = current
  }

  /** 滚动时重新量：长回复会让用户句长时间离开视口。 */
  function onPortScroll() {
    if (scrollRaf) return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      publishInView()
    })
  }

  function listenScroll(port: HTMLElement | null) {
    if (scrollTarget === port) return
    scrollTarget?.removeEventListener("scroll", onPortScroll)
    scrollTarget = port
    port?.addEventListener("scroll", onPortScroll, { passive: true })
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
      listenScroll(port)

      if (!port) {
        viewportWidth.value = 0
        contentWidth.value = 0
        publishInView()
        return
      }

      sizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const box = entry.contentBoxSize?.[0]
          const width = box?.inlineSize ?? entry.contentRect.width
          applySize(entry.target, width)
        }

        publishInView()
      })
      sizeObserver.observe(port)

      if (column) sizeObserver.observe(column)
    },
    { flush: "post" },
  )

  // 多源 watch 逐项 Object.is 比较，行键内容不变时不重复量
  watch(
    [() => toValue(layout.viewport), () => toValue(mountedKeys).join("\0")],
    () => {
      void nextTick(publishInView)
    },
    { flush: "post" },
  )

  onBeforeUnmount(() => {
    sizeObserver?.disconnect()
    listenScroll(null)

    if (scrollRaf) cancelAnimationFrame(scrollRaf)
  })
  return { items, inViewIds, currentId, hitStripWidth }
}
