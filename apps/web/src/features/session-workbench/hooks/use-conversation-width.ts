import { inject, onBeforeUnmount, shallowRef, watch, type ShallowRef } from "vue"
import { leftPanelKey } from "@components/layout/hooks/use-left-panel.js"

const CONTENT_WIDTH_KEY = "pig.conversation.contentWidth"

const CONTENT_DRAG_MIN = 640

const CONTENT_EDGE_BUDGET = 176 // 每侧 88px

function parseContentWidth(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function resolveContentWidth(columnWidth: number, preference: number): number {
  const max = Math.max(CONTENT_DRAG_MIN, columnWidth - CONTENT_EDGE_BUDGET)
  return Math.min(Math.max(preference, CONTENT_DRAG_MIN), max)
}

function readPreference(): number | null {
  try {
    return parseContentWidth(localStorage.getItem(CONTENT_WIDTH_KEY))
  } catch {
    return null
  }
}

function persistPreference(width: number) {
  try {
    localStorage.setItem(CONTENT_WIDTH_KEY, String(width))
  } catch {
    /* 隐私模式等场景下仅本页有效 */
  }
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
  let lastColumnWidth = 0

  function columnWidthOf(root: HTMLElement, measured?: number): number {
    return measured ?? root.offsetWidth
  }

  function publish(root: HTMLElement, measured?: number) {
    const column = Math.round(columnWidthOf(root, measured))

    if (column === lastColumnWidth && measured !== undefined) return
    lastColumnWidth = column
    root.style.setProperty("--conversation-column-width", `${column}px`)

    if (sidebarFrozen) return
    const preference = readPreference()

    if (preference === null) {
      root.style.removeProperty("--chat-user-width")
      return
    }

    root.style.setProperty("--chat-user-width", `${resolveContentWidth(column, preference)}px`)
  }

  function freezeForSidebar(active: boolean) {
    const root = rootEl.value

    if (!root) return

    if (active) {
      sidebarFrozen = true
      root.style.setProperty("--chat-user-width", `${snapshotWidth()}px`)
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
      lastColumnWidth = 0
      return
    }

    rootEl.value = el
    lastColumnWidth = 0
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
    root.style.setProperty("--chat-user-width", `${resolveContentWidth(root.offsetWidth, width)}px`)
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
