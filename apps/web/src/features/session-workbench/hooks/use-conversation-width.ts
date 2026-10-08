import { inject, onBeforeUnmount, shallowRef, watch, type ShallowRef } from "vue"
import { leftPanelKey } from "@components/layout/hooks/use-left-panel.js"
import { readNumber, writeNumber } from "@utils/storage.js"

const CONTENT_WIDTH_KEY = "pig.conversation.contentWidth"
const CONTENT_DRAG_MIN = 640
const CONTENT_DEFAULT_MIN = 680
const CONTENT_DEFAULT_MAX = 920
const CONTENT_EDGE_BUDGET = 176 // 每侧 88px

function defaultContentWidth(column: number): number {
  return Math.min(CONTENT_DEFAULT_MAX, Math.max(CONTENT_DEFAULT_MIN, column * 0.64))
}

function resolveContentWidth(columnWidth: number, preference: number): number {
  const max = Math.max(CONTENT_DRAG_MIN, columnWidth - CONTENT_EDGE_BUDGET)
  return Math.min(Math.max(preference, CONTENT_DRAG_MIN), max)
}

function readPreference(): number | undefined {
  return readNumber(CONTENT_WIDTH_KEY)
}

function persistPreference(width: number) {
  writeNumber(CONTENT_WIDTH_KEY, width)
}

export function useConversationWidth(): {
  resizing: Readonly<ShallowRef<boolean>>
  bindColumn: (el: unknown) => void
  snapshotWidth: () => number
  beginResize: () => void
  previewWidth: (width: number) => void
  commitWidth: (width: number) => void
  endResize: () => void
  nudgeWidth: (delta: number) => void
} {
  const rootEl = shallowRef<HTMLElement | null>(null)
  const resizing = shallowRef(false)
  const panel = inject(leftPanelKey, null)
  let observer: ResizeObserver | undefined
  let sidebarFrozen = false
  let lastContentWidth = -1

  // 唯一写入口：值没变就不碰样式，避免每帧触发子树重算
  function apply(root: HTMLElement, next: number) {
    if (next === lastContentWidth) return
    lastContentWidth = next
    root.style.setProperty("--chat-user-width", `${next}px`)
  }

  function publish(root: HTMLElement, measured?: number) {
    if (sidebarFrozen) return
    const column = Math.round(measured ?? root.offsetWidth)
    const preference = readPreference()

    apply(
      root,
      preference === undefined
        ? defaultContentWidth(column)
        : resolveContentWidth(column, preference),
    )
  }

  function freezeForSidebar(active: boolean) {
    const root = rootEl.value

    if (!root) return

    if (active) {
      sidebarFrozen = true
      apply(root, snapshotWidth())
      return
    }

    sidebarFrozen = false
    publish(root)
  }

  function bindColumn(el: unknown) {
    observer?.disconnect()
    observer = undefined

    if (!(el instanceof HTMLElement)) {
      rootEl.value = null
      lastContentWidth = -1
      return
    }

    rootEl.value = el
    lastContentWidth = -1
    observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentBoxSize?.[0]
      const width = box?.inlineSize ?? entries[0]?.contentRect.width

      if (width == null) return
      publish(el, width)
    })
    observer.observe(el)
  }

  function readDisplayedWidth(root: HTMLElement): number {
    const n = Number.parseFloat(getComputedStyle(root).getPropertyValue("--size-content"))
    return Number.isFinite(n) && n > 0 ? n : CONTENT_DRAG_MIN
  }

  function snapshotWidth(): number {
    const root = rootEl.value

    if (!root) return CONTENT_DRAG_MIN
    return resolveContentWidth(root.offsetWidth, readPreference() ?? readDisplayedWidth(root))
  }

  function beginResize() {
    resizing.value = true
  }

  function previewWidth(width: number) {
    const root = rootEl.value

    if (!root) return
    resizing.value = true
    apply(root, resolveContentWidth(root.offsetWidth, width))
  }

  function commitWidth(width: number) {
    const root = rootEl.value

    if (!root) return
    persistPreference(resolveContentWidth(root.offsetWidth, width))
  }

  function endResize() {
    resizing.value = false
    const root = rootEl.value

    if (root) publish(root)
  }

  function nudgeWidth(delta: number) {
    const root = rootEl.value

    if (!root) return
    const next = resolveContentWidth(root.offsetWidth, snapshotWidth() + delta)
    persistPreference(next)
    publish(root)
  }

  watch(
    () => panel?.resizing.value ?? false,
    (active) => freezeForSidebar(active),
    { flush: "sync" },
  )

  onBeforeUnmount(() => {
    observer?.disconnect()
  })
  return {
    resizing,
    bindColumn,
    snapshotWidth,
    beginResize,
    previewWidth,
    commitWidth,
    endResize,
    nudgeWidth,
  }
}
