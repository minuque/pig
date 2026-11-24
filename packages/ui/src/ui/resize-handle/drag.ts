export function dragResize(
  event: PointerEvent,
  handlers: { move: (delta: number) => void; end: (delta: number) => void },
): boolean {
  const handle = event.currentTarget

  if (!(handle instanceof HTMLElement)) return false
  event.preventDefault()
  handle.setPointerCapture(event.pointerId)
  const startX = event.clientX
  let pendingX = startX
  let frame = 0
  document.body.style.cursor = "ew-resize"
  document.body.style.userSelect = "none"

  const move = (next: PointerEvent) => {
    pendingX = next.clientX

    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      handlers.move(pendingX - startX)
    })
  }
  const stop = () => {
    handle.removeEventListener("pointermove", move)
    handle.removeEventListener("pointerup", stop)
    handle.removeEventListener("pointercancel", stop)

    if (frame) cancelAnimationFrame(frame)
    handlers.end(pendingX - startX)
    document.body.style.removeProperty("cursor")
    document.body.style.removeProperty("user-select")

    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
  }

  handle.addEventListener("pointermove", move)
  handle.addEventListener("pointerup", stop)
  handle.addEventListener("pointercancel", stop)
  return true
}
