import { clampAxis, panBy, worldDelta, zoomAt, type Camera, type Point } from "@/canvas/camera.js"
import { focusAllowsSpacePan, pointerIntent } from "@/canvas/gesture.js"

const DRAG_THRESHOLD = 3

type Drag = {
  kind: "pan" | "move"
  pointerId: number
  lastX: number
  lastY: number
  pendingX: number
  pendingY: number
  moved: boolean
  itemId: string | null
  origin: Point | null
}

type Pinch = {
  startDist: number
  startMid: Point
  startCamera: Camera
}

export type DragHost = {
  viewport: HTMLElement
  world: HTMLElement
  getCamera: () => Camera
  apply: (next: Camera) => void
  cancelZoom: () => void
  localPoint: (event: { clientX: number; clientY: number }) => Point
  save: () => void
  commitPosition: (id: string, point: Point) => void
  spaceHeld: () => boolean
  suppressClick: () => void
}

function itemIdOf(node: EventTarget | null): string | null {
  if (!(node instanceof Element)) return null
  return node.closest("[data-canvas-item]")?.getAttribute("data-canvas-item") ?? null
}

function spaceAllowed(): boolean {
  const active = document.activeElement

  if (!(active instanceof Element)) return true
  return focusAllowsSpacePan(
    active.tagName,
    active.getAttribute("role"),
    active instanceof HTMLElement && active.isContentEditable,
  )
}

export function attachDrag(host: DragHost) {
  const { viewport, world } = host
  let drag: Drag | null = null
  let pinch: Pinch | null = null
  const pointers = new Map<number, Point>()

  function endDrag(commit: boolean) {
    if (!drag) return

    if (commit && drag.kind === "move" && drag.itemId && drag.origin && drag.moved) {
      host.commitPosition(drag.itemId, drag.origin)
    }

    drag = null
    viewport.classList.remove("is-gesturing")
  }

  function beginPinch() {
    const points = [...pointers.values()]
    const a = points[0]
    const b = points[1]

    if (!a || !b) return
    pinch = {
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      startCamera: host.getCamera(),
    }
  }

  function onPointerDown(event: PointerEvent) {
    const target = event.target instanceof Element ? event.target : null
    const onControls = Boolean(target?.closest("[data-canvas-controls]"))

    if (onControls && event.button === 0 && !host.spaceHeld()) return

    const kind = pointerIntent({
      button: event.button,
      buttons: event.buttons,
      spaceHeld: host.spaceHeld(),
      spaceAllowed: spaceAllowed(),
      onHandle: Boolean(target?.closest("[data-canvas-handle]")),
      onEmpty: !target?.closest("[data-canvas-item]"),
      onControls,
    })

    pointers.set(event.pointerId, host.localPoint(event))

    if (pointers.size >= 2) {
      endDrag(true)
      beginPinch()
      event.preventDefault()
      return
    }

    if (kind === "ignore") return
    host.cancelZoom()
    event.preventDefault()
    const handle = target?.closest("[data-canvas-handle]")

    if (kind === "move" && handle instanceof HTMLElement) handle.focus({ preventScroll: true })
    else viewport.focus({ preventScroll: true })
    const point = host.localPoint(event)
    const id = itemIdOf(event.target)
    const item = id ? world.querySelector(`[data-canvas-item="${CSS.escape(id)}"]`) : null
    drag = {
      kind,
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      pendingX: 0,
      pendingY: 0,
      moved: false,
      itemId: kind === "move" ? id : null,
      origin:
        item instanceof HTMLElement
          ? {
              x: Number.parseFloat(item.style.left) || 0,
              y: Number.parseFloat(item.style.top) || 0,
            }
          : null,
    }
    viewport.classList.add("is-gesturing")
    viewport.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId) && !drag) return
    pointers.set(event.pointerId, host.localPoint(event))

    if (pinch) {
      const points = [...pointers.values()]
      const a = points[0]
      const b = points[1]

      if (!a || !b) return
      event.preventDefault()
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const zoomed = zoomAt(
        pinch.startCamera,
        pinch.startCamera.zoom * (dist / pinch.startDist),
        pinch.startMid,
      )

      host.apply(panBy(zoomed, mid.x - pinch.startMid.x, mid.y - pinch.startMid.y))
      return
    }

    if (!drag || drag.pointerId !== event.pointerId) return
    const point = host.localPoint(event)
    const dx = point.x - drag.lastX
    const dy = point.y - drag.lastY
    drag.lastX = point.x
    drag.lastY = point.y
    drag.pendingX += dx
    drag.pendingY += dy

    if (!drag.moved && Math.hypot(drag.pendingX, drag.pendingY) < DRAG_THRESHOLD) return
    drag.moved = true
    host.suppressClick()
    event.preventDefault()
    const stepX = drag.pendingX
    const stepY = drag.pendingY
    drag.pendingX = 0
    drag.pendingY = 0

    if (drag.kind === "pan") {
      host.apply(panBy(host.getCamera(), stepX, stepY))
      return
    }

    if (!drag.itemId || !drag.origin) return
    const delta = worldDelta(stepX, stepY, host.getCamera().zoom)
    drag.origin = { x: clampAxis(drag.origin.x + delta.x), y: clampAxis(drag.origin.y + delta.y) }
    const item = world.querySelector(`[data-canvas-item="${CSS.escape(drag.itemId)}"]`)

    if (item instanceof HTMLElement) {
      item.style.left = `${drag.origin.x}px`
      item.style.top = `${drag.origin.y}px`
    }
  }

  function onPointerUp(event: PointerEvent) {
    pointers.delete(event.pointerId)

    if (pinch && pointers.size < 2) {
      pinch = null
      host.save()
    }

    if (drag?.pointerId !== event.pointerId) return
    const moved = drag.moved
    endDrag(true)

    if (moved) {
      host.suppressClick()
      host.save()
    }

    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId)
  }

  viewport.addEventListener("pointerdown", onPointerDown)
  viewport.addEventListener("pointermove", onPointerMove)
  viewport.addEventListener("pointerup", onPointerUp)
  viewport.addEventListener("pointercancel", onPointerUp)
  viewport.addEventListener("lostpointercapture", onPointerUp)
  return {
    clear() {
      pinch = null
      endDrag(true)
      pointers.clear()
    },
    destroy() {
      this.clear()
      viewport.removeEventListener("pointerdown", onPointerDown)
      viewport.removeEventListener("pointermove", onPointerMove)
      viewport.removeEventListener("pointerup", onPointerUp)
      viewport.removeEventListener("pointercancel", onPointerUp)
      viewport.removeEventListener("lostpointercapture", onPointerUp)
    },
  }
}
