import { onBeforeUnmount, shallowRef } from "vue"
import type { TransferDraft } from "@pig/ui/transfer-lists"
import {
  dropSessions,
  markSessionDragging,
  markSessionDropTarget,
  sessionDropTargetAt,
} from "@features/session-nav/lib/context-drag.js"

export interface DragGhost {
  x: number
  y: number
  title: string
}

export function useSessionDropOut(options: {
  bounds: () => HTMLElement | undefined
  title: (id: string) => string | undefined
}) {
  const outside = shallowRef(false)
  const ghost = shallowRef<DragGhost | null>(null)
  let dragged: string | null = null
  let droppedOutside = false

  function isOutsideX(clientX: number): boolean {
    const box = options.bounds()?.getBoundingClientRect()
    return !!box && (clientX < box.left || clientX > box.right)
  }

  function onMove(event: PointerEvent) {
    if (!dragged) return
    const away = isOutsideX(event.clientX)

    outside.value = away
    ghost.value = away
      ? { x: event.clientX, y: event.clientY, title: options.title(dragged) ?? "" }
      : null
    markSessionDragging(away)
    markSessionDropTarget(away ? sessionDropTargetAt({ x: event.clientX, y: event.clientY }) : null)
  }

  function onUp(event: PointerEvent) {
    if (!dragged) return
    const away = isOutsideX(event.clientX)

    droppedOutside = away

    if (!away) return
    const target = sessionDropTargetAt({ x: event.clientX, y: event.clientY })
    const title = options.title(dragged)

    if (target && title !== undefined) dropSessions(target, [{ id: dragged, title }])
  }

  function stop() {
    window.removeEventListener("pointermove", onMove)
    markSessionDropTarget(null)
    markSessionDragging(false)
    dragged = null
    outside.value = false
    ghost.value = null
    queueMicrotask(() => {
      droppedOutside = false
    })
  }

  function track(moving: TransferDraft | null) {
    if (!moving?.pointer) {
      if (dragged) stop()
      return
    }

    if (dragged) return
    droppedOutside = false
    dragged = moving.key
    window.addEventListener("pointermove", onMove, { passive: true })
  }

  window.addEventListener("pointerup", onUp, { capture: true })

  onBeforeUnmount(() => {
    window.removeEventListener("pointerup", onUp, { capture: true })
    stop()
  })
  return {
    track,
    outside,
    ghost,
    wasOutside: () => outside.value || droppedOutside,
  }
}
