import { inject, onBeforeUnmount, shallowRef, watch, type ShallowRef } from "vue"
import { leftPanelKey } from "@components/layout/hooks/use-left-panel.js"

export const CONTENT_WIDTH_KEY = "pig.conversation.contentWidth"

/** 拖拽下限，与列两侧手柄热区预算对齐。 */
export const CONTENT_DRAG_MIN = 640
/** 自适应下限：比原 732 正文略窄一档。 */
export const CONTENT_ADAPTIVE_FLOOR = 680
export const CONTENT_ADAPTIVE_RATIO = 0.64
export const CONTENT_ADAPTIVE_CAP = 920
/** 每侧 88px（24 内缩 + 40 热区 + 24 安全区）。 */
export const CONTENT_EDGE_BUDGET = 176

/** 解析持久化的正文宽度：非正有限数丢弃。 */
export function parseContentWidth(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 列宽上的显示宽度：有偏好则钳制偏好，否则走 680 / 64% / 920。 */
export function resolveContentWidth(columnWidth: number, preference: number | null): number {
  const max = Math.max(CONTENT_DRAG_MIN, columnWidth - CONTENT_EDGE_BUDGET)
  if (preference !== null) return Math.min(Math.max(preference, CONTENT_DRAG_MIN), max)
  return Math.max(
    CONTENT_ADAPTIVE_FLOOR,
    Math.min(columnWidth * CONTENT_ADAPTIVE_RATIO, CONTENT_ADAPTIVE_CAP),
  )
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

/** 会话列正文宽度轴：观察列宽、发布 CSS 变量、拖拽覆盖与存储。 */
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

  function publish(root: HTMLElement) {
    const column = root.offsetWidth
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
      return
    }
    rootEl.value = el
    observer = new ResizeObserver(() => {
      if (sidebarFrozen) return
      publish(el)
    })
    observer.observe(el)
    publish(el)
  }

  function snapshotWidth(): number {
    const root = rootEl.value
    if (!root) return CONTENT_ADAPTIVE_FLOOR
    return resolveContentWidth(root.offsetWidth, readPreference())
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
