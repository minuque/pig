import { bindDragPreview, isRTL } from "@ui-sdk/core"
import {
  computeLiftOffset,
  LIFT_POP_SPRING,
  POINTER_SPRING,
  SETTLE_SPRING,
  stepSpring,
  type AxisRect,
  type DragLiftSide,
  type DragOrientation,
  type ItemMotion,
  type LineRect,
  type SpringAxis,
  type SpringParams,
} from "./drag-physics.js"

const SETTLE_CLEANUP_MS = 280
const PREVIEW_SETTLE_TIMEOUT_MS = 420
let globalDragCount = 0

export interface DropHintHandle {
  show(pos: LineRect, reducedMotion: boolean): void
  hide(): void
  destroy(): void
}

export interface LiftedPreviewHandle {
  move(x: number, y: number): void
  settleTo(targetRect: DOMRect | null, options: { fadeOut?: boolean; onDone: () => void }): void
  destroy(): void
}

export interface FlipEntry {
  el: HTMLElement
  before: DOMRect
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
  )
}

export function acquireGlobalDragging(): () => void {
  if (typeof document === "undefined") return () => {}
  let released = false

  globalDragCount += 1
  document.documentElement.toggleAttribute("data-drag-active", true)
  return () => {
    if (released) return
    released = true
    globalDragCount = Math.max(0, globalDragCount - 1)

    if (globalDragCount === 0) document.documentElement.removeAttribute("data-drag-active")
  }
}

export function measureContainerRects(
  container: HTMLElement,
  elements: readonly HTMLElement[],
  orientation: DragOrientation,
): { containerRect: AxisRect; items: AxisRect[] } {
  const box = container.getBoundingClientRect()
  const originX = box.left + container.clientLeft - container.scrollLeft
  const originY = box.top + container.clientTop - container.scrollTop
  const vertical = orientation === "vertical"
  const containerRect: AxisRect = {
    start: 0,
    size: vertical
      ? Math.max(container.scrollHeight, box.height)
      : Math.max(container.scrollWidth, box.width),
    crossStart: 0,
    crossSize: vertical ? container.clientWidth || box.width : container.clientHeight || box.height,
  }
  const items = elements.map((el) => {
    const rect = el.getBoundingClientRect()
    return vertical
      ? {
          start: rect.top - originY,
          size: rect.height,
          crossStart: rect.left - originX,
          crossSize: rect.width,
        }
      : {
          start: rect.left - originX,
          size: rect.width,
          crossStart: rect.top - originY,
          crossSize: rect.height,
        }
  })

  return { containerRect, items }
}

export function pointerToContainerAxis(
  container: HTMLElement,
  point: { x: number; y: number },
  orientation: DragOrientation,
): number {
  const box = container.getBoundingClientRect()
  return orientation === "vertical"
    ? point.y - box.top - container.clientTop + container.scrollTop
    : point.x - box.left - container.clientLeft + container.scrollLeft
}

export function createDropHint(
  container: HTMLElement,
  orientation: DragOrientation,
): DropHintHandle {
  const doc = container.ownerDocument
  const outer = doc.createElement("div")
  const bar = doc.createElement("span")
  const addedHost = getComputedStyle(container).position === "static"
  let visible = false

  if (addedHost) container.setAttribute("data-drag-host", "")

  outer.setAttribute("data-drag-hint", "")
  outer.setAttribute("data-orientation", orientation)
  outer.setAttribute("aria-hidden", "true")
  bar.setAttribute("data-drag-hint-bar", "")
  outer.append(bar)
  container.append(outer)

  function show(pos: LineRect, reducedMotion: boolean) {
    const vertical = orientation === "vertical"
    const width = vertical ? Math.max(0, pos.crossSize) : 2
    const height = vertical ? 2 : Math.max(0, pos.crossSize)
    const tx = vertical ? pos.crossStart : pos.axis - 1
    const ty = vertical ? pos.axis - 1 : pos.crossStart
    const instant = !visible || reducedMotion

    if (instant) outer.setAttribute("data-instant", "")

    outer.style.width = `${width}px`
    outer.style.height = `${height}px`
    outer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`

    if (instant && !reducedMotion) {
      void outer.offsetWidth
      outer.removeAttribute("data-instant")
    }

    outer.setAttribute("data-visible", "")
    visible = true
  }

  function hide() {
    if (!visible) return
    outer.removeAttribute("data-visible")
    visible = false
  }

  function destroy() {
    outer.remove()

    if (addedHost) container.removeAttribute("data-drag-host")
  }

  return { show, hide, destroy }
}

export function createLiftedPreview(
  sourceEl: HTMLElement,
  options: {
    start: { x: number; y: number }
    orientation: DragOrientation
    liftSide: DragLiftSide
  },
): LiftedPreviewHandle {
  const startRect = sourceEl.getBoundingClientRect()
  const preview = bindDragPreview(sourceEl, options.start)
  const view = sourceEl.ownerDocument.defaultView ?? window
  const lift = computeLiftOffset(
    options.orientation,
    { width: startRect.width, height: startRect.height },
    options.liftSide,
    isRTL(sourceEl),
  )

  preview.el.removeAttribute("data-moving")
  preview.el.removeAttribute("data-dragging")
  preview.el.removeAttribute("data-drag-hidden")
  preview.el.style.transformOrigin = "center"
  preview.el.style.translate = "none"

  const dx: SpringAxis = { value: 0, velocity: 0 }
  const dy: SpringAxis = { value: 0, velocity: 0 }
  const liftX: SpringAxis = { value: 0, velocity: 0 }
  const liftY: SpringAxis = { value: 0, velocity: 0 }
  const scale: SpringAxis = { value: 1, velocity: 0 }

  let targetDx = 0
  let targetDy = 0
  let targetLiftX = lift.x
  let targetLiftY = lift.y
  let targetScale = lift.scale
  let followParams: SpringParams = POINTER_SPRING
  let liftParams: SpringParams = LIFT_POP_SPRING
  let frame = 0
  let lastTime = 0
  let settling = false
  let destroyed = false
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined
  let onSettleDone: (() => void) | undefined

  function render() {
    preview.el.style.transform = `translate3d(${dx.value + liftX.value}px, ${dy.value + liftY.value}px, 0) scale(${scale.value})`
  }

  function finishSettle() {
    if (destroyed) return
    const done = onSettleDone

    onSettleDone = undefined
    destroy()
    done?.()
  }

  function tick(now: number) {
    frame = 0

    if (destroyed) return

    const dt = lastTime ? (now - lastTime) / 1000 : 1 / 60
    lastTime = now

    const doneDx = stepSpring(dx, targetDx, followParams, dt)
    const doneDy = stepSpring(dy, targetDy, followParams, dt)
    const doneLiftX = stepSpring(liftX, targetLiftX, liftParams, dt)
    const doneLiftY = stepSpring(liftY, targetLiftY, liftParams, dt)
    const doneScale = stepSpring(scale, targetScale, liftParams, dt)

    render()

    const allSettled = doneDx && doneDy && doneLiftX && doneLiftY && doneScale

    if (allSettled) {
      if (settling) finishSettle()
      return
    }

    frame = view.requestAnimationFrame(tick)
  }

  function ensureRunning() {
    if (destroyed || frame) return
    lastTime = 0
    frame = view.requestAnimationFrame(tick)
  }

  function move(x: number, y: number) {
    if (settling || destroyed) return
    targetDx = x - options.start.x
    targetDy = y - options.start.y
    ensureRunning()
  }

  function settleTo(targetRect: DOMRect | null, opts: { fadeOut?: boolean; onDone: () => void }) {
    if (destroyed || !targetRect) {
      destroy()
      opts.onDone()
      return
    }

    settling = true
    onSettleDone = opts.onDone
    followParams = SETTLE_SPRING
    liftParams = SETTLE_SPRING
    targetDx = targetRect.left - startRect.left
    targetDy = targetRect.top - startRect.top
    targetLiftX = 0
    targetLiftY = 0
    targetScale = opts.fadeOut ? 0.85 : 1

    if (opts.fadeOut) {
      preview.el.style.transition = "opacity var(--duration-fast) var(--ease-out)"
      preview.el.style.opacity = "0"
    }

    clearTimeout(fallbackTimer)
    fallbackTimer = setTimeout(finishSettle, PREVIEW_SETTLE_TIMEOUT_MS)
    ensureRunning()
  }

  function destroy() {
    if (destroyed) return
    destroyed = true

    if (frame) {
      view.cancelAnimationFrame(frame)
      frame = 0
    }

    clearTimeout(fallbackTimer)
    onSettleDone = undefined
    preview.remove()
  }

  ensureRunning()
  return { move, settleTo, destroy }
}

export function applyItemMotions(
  elements: readonly HTMLElement[],
  motions: readonly ItemMotion[],
  orientation: DragOrientation,
  skipIndex = -1,
): void {
  const vertical = orientation === "vertical"

  for (let i = 0; i < elements.length; i += 1) {
    if (i === skipIndex) continue
    const el = elements[i]!
    const motion = motions[i] ?? { shift: 0, delayMs: 0 }

    el.setAttribute("data-drag-motion", "")
    el.removeAttribute("data-drag-instant")
    el.style.transitionDelay = `${motion.delayMs}ms`
    el.style.transform = vertical
      ? `translate3d(0, ${motion.shift}px, 0)`
      : `translate3d(${motion.shift}px, 0, 0)`
  }
}

export function setKeyboardDragVars(
  el: HTMLElement,
  offset: { x: number; y: number; scale: number } | null,
): void {
  if (!offset) {
    el.style.removeProperty("--drag-kb-x")
    el.style.removeProperty("--drag-kb-y")
    el.style.removeProperty("--drag-kb-scale")
    return
  }

  el.style.setProperty("--drag-kb-x", `${offset.x}px`)
  el.style.setProperty("--drag-kb-y", `${offset.y}px`)
  el.style.setProperty("--drag-kb-scale", String(offset.scale))
}

export function clearItemStyles(elements: Iterable<HTMLElement>): void {
  for (const el of elements) {
    el.removeAttribute("data-drag-motion")
    el.removeAttribute("data-drag-instant")
    el.style.removeProperty("transform")
    el.style.removeProperty("transition-delay")
    setKeyboardDragVars(el, null)
  }
}

export function springItemsBack(
  elements: readonly HTMLElement[],
  reducedMotion: boolean,
  onDone?: () => void,
): () => void {
  if (reducedMotion || !elements.length) {
    clearItemStyles(elements)
    onDone?.()
    return () => {}
  }

  const animated: HTMLElement[] = []

  for (const el of elements) {
    if (!el.hasAttribute("data-drag-motion") && !el.style.transform) continue
    el.removeAttribute("data-drag-instant")
    el.setAttribute("data-drag-motion", "")
    el.style.transitionDelay = "0ms"
    el.style.transform = "translate3d(0, 0, 0)"
    animated.push(el)
  }

  if (!animated.length) {
    clearItemStyles(elements)
    onDone?.()
    return () => {}
  }

  const timer = setTimeout(() => {
    clearItemStyles(animated)
    onDone?.()
  }, SETTLE_CLEANUP_MS)

  return () => {
    clearTimeout(timer)
    clearItemStyles(animated)
  }
}

export function runFlipSettle(
  entries: readonly FlipEntry[],
  reducedMotion: boolean,
  onDone?: () => void,
): () => void {
  clearItemStyles(entries.map((entry) => entry.el))

  if (reducedMotion || !entries.length) {
    onDone?.()
    return () => {}
  }

  const moved: { el: HTMLElement; dx: number; dy: number }[] = []

  for (const entry of entries) {
    const after = entry.el.getBoundingClientRect()
    const dx = entry.before.left + entry.before.width / 2 - (after.left + after.width / 2)
    const dy = entry.before.top + entry.before.height / 2 - (after.top + after.height / 2)

    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) moved.push({ el: entry.el, dx, dy })
  }

  if (!moved.length) {
    onDone?.()
    return () => {}
  }

  for (const item of moved) {
    item.el.setAttribute("data-drag-instant", "")
    item.el.style.transform = `translate3d(${item.dx}px, ${item.dy}px, 0)`
  }

  void moved[0]!.el.offsetWidth

  for (const item of moved) {
    item.el.removeAttribute("data-drag-instant")
    item.el.setAttribute("data-drag-motion", "")
    item.el.style.transitionDelay = "0ms"
    item.el.style.transform = "translate3d(0, 0, 0)"
  }

  const animated = moved.map((item) => item.el)
  const timer = setTimeout(() => {
    clearItemStyles(animated)
    onDone?.()
  }, SETTLE_CLEANUP_MS)

  return () => {
    clearTimeout(timer)
    clearItemStyles(animated)
  }
}
