import { onBeforeUnmount, shallowRef, watch } from "vue"

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  if (left.size !== right.size) return false

  for (const value of left) if (!right.has(value)) return false
  return true
}

function rowIdOf(node: Node | null): string | null {
  let current: Node | null = node

  while (current) {
    if (current instanceof ShadowRoot) {
      current = current.host
      continue
    }

    if (current instanceof HTMLElement && current.dataset.rowId) return current.dataset.rowId
    current = current.parentNode
  }

  return null
}

/** 选区或焦点所在的行强制挂载，拖选和键盘操作时行不会被卸掉。 */
export function useTranscriptKeepAlive(getRoot: () => HTMLElement | null) {
  const keepAlive = shallowRef<ReadonlySet<string>>(new Set())
  const selectionIds = new Set<string>()
  let focusId: string | null = null
  let boundRoot: HTMLElement | null = null

  function publish() {
    const next = new Set(selectionIds)

    if (focusId) next.add(focusId)

    if (sameSet(next, keepAlive.value)) return
    keepAlive.value = next
  }

  function collectSelection(root: HTMLElement) {
    const selection = document.getSelection()

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return
    const rows = root.querySelectorAll<HTMLElement>("[data-row-id]")

    for (let index = 0; index < selection.rangeCount; index += 1) {
      const range = selection.getRangeAt(index)

      for (const node of [
        range.startContainer,
        range.endContainer,
        range.commonAncestorContainer,
      ]) {
        const id = rowIdOf(node)

        if (id) selectionIds.add(id)
      }

      for (const el of rows) {
        const id = el.dataset.rowId

        if (id && range.intersectsNode(el)) selectionIds.add(id)
      }
    }
  }

  function onSelectionChange() {
    selectionIds.clear()
    const root = getRoot()

    if (root) collectSelection(root)
    publish()
  }

  function onFocusChange() {
    // 焦点事件里 document.activeElement 还没落定，放微任务里读
    queueMicrotask(() => {
      const root = getRoot()
      const active = document.activeElement

      focusId = root && active instanceof Node && root.contains(active) ? rowIdOf(active) : null
      publish()
    })
  }

  function bind(next: HTMLElement | null) {
    if (boundRoot === next) return

    if (boundRoot) {
      boundRoot.removeEventListener("focusin", onFocusChange)
      boundRoot.removeEventListener("focusout", onFocusChange)
    }

    boundRoot = next

    if (!next) return
    next.addEventListener("focusin", onFocusChange)
    next.addEventListener("focusout", onFocusChange)
  }

  document.addEventListener("selectionchange", onSelectionChange, { passive: true })

  watch(getRoot, (el) => bind(el), { flush: "post", immediate: true })

  onBeforeUnmount(() => {
    document.removeEventListener("selectionchange", onSelectionChange)
    bind(null)
  })
  return { keepAlive }
}
