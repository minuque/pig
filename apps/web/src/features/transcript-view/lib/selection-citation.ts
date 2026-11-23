export interface SelectionPoint {
  x: number
  y: number
}

export interface SelectionRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface CapturedAssistantSelection {
  sessionId: string
  entryId: string
  text: string
  source: HTMLElement
  range: Range
}

export interface SelectionActionsOptions {
  element: HTMLElement
  getActionElement?: () => HTMLElement | null
  restoreAfterScroll?: boolean
  immediateMultiClick?: boolean
  onSelection: (pointer: SelectionPoint | null) => void
  onDismiss: (reason: "interaction" | "cancel") => void
}

export interface SelectionActionsController {
  readonly pending: boolean
  cancel: () => void
  selectionChanged: () => void
  dispose: () => void
}

const SELECTION_MULTI_CLICK_INTERVAL_MS = 500
const SELECTION_SCROLL_SETTLE_MS = 150
const CONTROL_SELECTOR = 'button, input, textarea, select, [role="button"], [contenteditable]'
const EXCLUDED_SELECTOR = `${CONTROL_SELECTOR}, [hidden], [aria-hidden="true"], script, style, template, noscript, svg`
const SOURCE_SELECTOR = "[data-assistant-citation-source]"

export function isSelectionRectVisible(
  rect: SelectionRect,
  clips: readonly SelectionRect[],
): boolean {
  let { left, top, right, bottom } = rect

  for (const clip of clips) {
    left = Math.max(left, clip.left)
    top = Math.max(top, clip.top)
    right = Math.min(right, clip.right)
    bottom = Math.min(bottom, clip.bottom)
  }

  return right > left && bottom > top
}

export function resolveSelectionActionPosition(options: {
  bounds: { left: number; top: number; width: number; height: number }
  sourceBounds: { left: number; right: number }
  selectionRect: { right: number; bottom: number }
  viewport: { width: number; height: number }
}): SelectionPoint {
  const { bounds, sourceBounds, selectionRect, viewport } = options
  const clampedRight = Math.min(
    Math.max(selectionRect.right, sourceBounds.left),
    sourceBounds.right,
  )
  const preferred = { x: clampedRight, y: selectionRect.bottom + 4 }
  return {
    x: Math.max(
      8,
      Math.min(Math.max(bounds.left, preferred.x), bounds.left + bounds.width, viewport.width - 8),
    ),
    y: Math.max(
      8,
      Math.min(Math.max(bounds.top, preferred.y), bounds.top + bounds.height, viewport.height - 8),
    ),
  }
}

export function lastSelectionClientRect(range: Range): DOMRect {
  const rects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 || rect.height > 0,
  )
  return rects[rects.length - 1] ?? range.getBoundingClientRect()
}

function clampRectToSource(source: HTMLElement, rect: DOMRect): DOMRect {
  const bounds = source.getBoundingClientRect()
  const left = Math.min(Math.max(rect.left, bounds.left), bounds.right)
  const right = Math.max(Math.min(rect.right, bounds.right), left)
  return new DOMRect(left, rect.top, right - left, rect.height)
}

export function createSelectionRangeAnchor(
  source: HTMLElement,
  range: Range,
): { getBoundingClientRect: () => DOMRect } {
  let lastRect = clampRectToSource(source, lastSelectionClientRect(range))
  return {
    getBoundingClientRect: () => {
      if (!source.isConnected || range.collapsed) return lastRect
      const rect = lastSelectionClientRect(range)

      if (rect.width <= 0 && rect.height <= 0) return lastRect
      lastRect = clampRectToSource(source, rect)
      return lastRect
    },
  }
}

function excludedAncestor(node: Node): Element | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
  return element?.closest(EXCLUDED_SELECTOR) ?? null
}

function isUnselectable(text: Text): boolean {
  const element = text.parentElement
  const view = element?.ownerDocument.defaultView
  return Boolean(element && view && view.getComputedStyle(element).userSelect === "none")
}

function selectedTextBoundary(range: Range, node: Node, last: boolean): Text | null {
  if (!range.intersectsNode(node)) return null

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node as Text
    const start = node === range.startContainer ? range.startOffset : 0
    const end = node === range.endContainer ? range.endOffset : text.length
    return start < end && !excludedAncestor(text) && !isUnselectable(text) ? text : null
  }

  for (
    let child = last ? node.lastChild : node.firstChild;
    child !== null;
    child = last ? child.previousSibling : child.nextSibling
  ) {
    const boundary = selectedTextBoundary(range, child, last)

    if (boundary !== null) return boundary
  }

  return null
}

function isUsableRange(root: HTMLElement, range: Range): boolean {
  return (
    !range.collapsed &&
    root.contains(range.startContainer) &&
    root.contains(range.endContainer) &&
    excludedAncestor(range.startContainer) === null &&
    excludedAncestor(range.endContainer) === null
  )
}

function clippingAncestors(
  node: Element,
  viewport: HTMLElement,
  viewportRect: DOMRect,
): SelectionRect[] {
  const clips: SelectionRect[] = [viewportRect]

  for (
    let element = node.parentElement;
    element && element !== viewport;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element)
    const clipX = style.overflowX !== "visible"
    const clipY = style.overflowY !== "visible"

    if (!clipX && !clipY) continue
    const bounds = element.getBoundingClientRect()
    const left = bounds.left + element.clientLeft
    const top = bounds.top + element.clientTop

    clips.push({
      left: clipX ? left : -Infinity,
      right: clipX ? left + element.clientWidth : Infinity,
      top: clipY ? top : -Infinity,
      bottom: clipY ? top + element.clientHeight : Infinity,
    })
  }

  return clips
}

function hasVisibleSelectedText(
  range: Range,
  viewport: HTMLElement,
  viewportRect: DOMRect,
): boolean {
  const common = range.commonAncestorContainer
  const walker = viewport.ownerDocument.createTreeWalker(common, NodeFilter.SHOW_TEXT)
  let node: Node | null = common.nodeType === Node.TEXT_NODE ? common : walker.nextNode()

  for (; node; node = walker.nextNode()) {
    if (!range.intersectsNode(node) || node.nodeType !== Node.TEXT_NODE) continue
    const textNode = node as Text

    if (excludedAncestor(textNode) || isUnselectable(textNode)) continue
    const fragment = viewport.ownerDocument.createRange()

    fragment.selectNodeContents(textNode)

    if (textNode === range.startContainer) fragment.setStart(textNode, range.startOffset)

    if (textNode === range.endContainer) fragment.setEnd(textNode, range.endOffset)

    if (!fragment.toString().trim()) continue
    const lines = Array.from(fragment.getClientRects())

    if (!lines.some((line) => isSelectionRectVisible(line, [viewportRect]))) continue

    const clips = textNode.parentElement
      ? clippingAncestors(textNode.parentElement, viewport, viewportRect)
      : [viewportRect]

    if (lines.some((line) => isSelectionRectVisible(line, clips))) return true
  }

  return false
}

export function captureAssistantSelection(
  viewport: HTMLElement,
  selection: Selection | null,
): CapturedAssistantSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0).cloneRange()
  const first = selectedTextBoundary(range, range.commonAncestorContainer, false)
  const last = selectedTextBoundary(range, range.commonAncestorContainer, true)

  if (!first || !last) return null
  const firstSource = first.parentElement?.closest<HTMLElement>(SOURCE_SELECTOR)
  const lastSource = last.parentElement?.closest<HTMLElement>(SOURCE_SELECTOR)

  if (!firstSource || firstSource !== lastSource || !viewport.contains(firstSource)) return null
  const entryId = firstSource.dataset["assistantCitationSource"]?.trim() ?? ""
  const sessionId = firstSource.dataset["assistantCitationSession"]?.trim() ?? ""

  if (!entryId || !sessionId) return null
  range.setStart(first, first === range.startContainer ? range.startOffset : 0)
  range.setEnd(last, last === range.endContainer ? range.endOffset : last.length)

  if (!isUsableRange(firstSource, range)) return null
  const text = range.toString()

  if (!text.trim()) return null
  const viewportRect = viewport.getBoundingClientRect()

  if (!isSelectionRectVisible(range.getBoundingClientRect(), [viewportRect])) return null

  if (!hasVisibleSelectedText(range, viewport, viewportRect)) return null
  return { sessionId, entryId, text, source: firstSource, range }
}

export function observeSelectionActions(
  options: SelectionActionsOptions,
): SelectionActionsController {
  const {
    element,
    getActionElement,
    restoreAfterScroll = false,
    immediateMultiClick = false,
    onSelection,
    onDismiss,
  } = options
  const doc = element.ownerDocument
  const view = doc.defaultView!
  let pointerDown = false
  let gestureActive = false
  let dismissed = false
  let restorable = false
  let pointer: SelectionPoint | null = null
  let timer: number | null = null
  let frame: number | null = null
  const isActionTarget = (target: EventTarget | null) =>
    target !== null && (getActionElement?.()?.contains(target as Node) ?? false)
  const cancelPending = () => {
    if (timer !== null) view.clearTimeout(timer)

    if (frame !== null) view.cancelAnimationFrame(frame)
    timer = null
    frame = null
  }
  const cancel = () => {
    cancelPending()
    pointerDown = false
    gestureActive = false
    pointer = null
    dismissed = true
    restorable = false
  }
  const dismiss = () => {
    cancel()
    onDismiss("cancel")
  }
  const onContextMenu = () => {
    cancel()
    onDismiss("interaction")
  }
  const schedule = (delay: number) => {
    restorable = true
    cancelPending()
    timer = view.setTimeout(() => {
      timer = null
      frame = view.requestAnimationFrame(() => {
        frame = null
        onSelection(pointer)
      })
    }, delay)
  }
  const onPointerDown = (event: PointerEvent) => {
    if (!event.isPrimary) return

    if (isActionTarget(event.target)) {
      cancel()
      return
    }

    cancelPending()
    const inside = element.contains(event.target as Node)
    pointerDown = inside && event.button === 0

    gestureActive = false
    restorable = false
    pointer = null

    if (inside) {
      dismissed = false
      onDismiss("interaction")
    } else if (getActionElement?.()) {
      dismissed = false
      onDismiss("cancel")
    }
  }
  const onSelectionStart = (event: PointerEvent) => {
    if (!event.isPrimary) return
    const target = event.target as Element | null

    if (target?.closest('button, [role="button"]')) return
    gestureActive = event.button === 0 && !event.defaultPrevented
    dismissed = !gestureActive
  }
  const onPointerUp = (event: PointerEvent) => {
    if (event.isPrimary && event.button === 0) pointerDown = false
  }
  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return
    pointerDown = false

    if (!gestureActive) return
    gestureActive = false
    const multiClick = event.detail >= 2

    pointer = multiClick && immediateMultiClick ? null : { x: event.clientX, y: event.clientY }
    schedule(multiClick && !immediateMultiClick ? SELECTION_MULTI_CLICK_INTERVAL_MS : 0)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (isActionTarget(event.target) && event.key !== "Escape") return

    if (event.key === "Escape") {
      dismiss()
    } else if (!pointerDown) {
      cancelPending()
      gestureActive = false
      pointer = null
      dismissed = false
    }
  }
  const onFocusIn = (event: FocusEvent) => {
    if (isActionTarget(event.target)) cancel()
    else if (!pointerDown && getActionElement?.()) dismiss()
  }
  const onScroll = () => {
    cancelPending()

    if (!pointerDown) {
      pointer = null

      if (restoreAfterScroll && !dismissed && restorable) schedule(SELECTION_SCROLL_SETTLE_MS)
      else dismissed = true
    }

    onDismiss("cancel")
  }

  doc.addEventListener("pointerdown", onPointerDown, true)
  element.addEventListener("pointerdown", onSelectionStart)
  view.addEventListener("pointerup", onPointerUp)
  view.addEventListener("mouseup", onMouseUp)
  view.addEventListener("pointercancel", dismiss)
  doc.addEventListener("keydown", onKeyDown)
  doc.addEventListener("focusin", onFocusIn)
  element.addEventListener("contextmenu", onContextMenu, true)
  element.addEventListener("scroll", onScroll, true)
  view.addEventListener("blur", dismiss)
  view.addEventListener("resize", dismiss)
  return {
    get pending() {
      return timer !== null || frame !== null
    },
    cancel,
    selectionChanged() {
      if (isActionTarget(doc.activeElement)) return

      if (pointerDown || gestureActive) onDismiss("cancel")
      else if (!dismissed && timer === null && frame === null) schedule(0)
    },
    dispose() {
      cancel()
      doc.removeEventListener("pointerdown", onPointerDown, true)
      element.removeEventListener("pointerdown", onSelectionStart)
      view.removeEventListener("pointerup", onPointerUp)
      view.removeEventListener("mouseup", onMouseUp)
      view.removeEventListener("pointercancel", dismiss)
      doc.removeEventListener("keydown", onKeyDown)
      doc.removeEventListener("focusin", onFocusIn)
      element.removeEventListener("contextmenu", onContextMenu, true)
      element.removeEventListener("scroll", onScroll, true)
      view.removeEventListener("blur", dismiss)
      view.removeEventListener("resize", dismiss)
    },
  }
}
