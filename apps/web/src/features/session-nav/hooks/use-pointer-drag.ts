export interface PointerPoint {
  x: number
  y: number
}

export interface PointerDragOptions {
  /** 超过这段位移才算拖起，之前的松手仍是点击。 */
  distance: number
  onStart(point: PointerPoint): void
  onMove(point: PointerPoint): void
  onDrop(point: PointerPoint): void
  /** 拖起之后被取消：Esc、失焦、切走、窗口变化。 */
  onCancel(): void
  /** 收尾总会调用；started 表示是否真的拖起过。 */
  onFinish?(started: boolean): void
}

export interface PointerDragHandle {
  cancel(): void
}

/** 按下后跟踪同一指针：过阈值才拖起，拖起后吞掉随后的点击、选区与右键菜单。 */
export function startPointerDrag(
  event: PointerEvent,
  options: PointerDragOptions,
): PointerDragHandle {
  const doc = (event.target instanceof Node ? event.target.ownerDocument : null) ?? document
  const win = doc.defaultView ?? window
  const pointerId = event.pointerId
  const origin = { x: event.clientX, y: event.clientY }
  let phase: "pending" | "dragging" | "finished" = "pending"
  const preventDefault = (e: Event) => e.preventDefault()
  const clearSelection = () => doc.getSelection()?.removeAllRanges()
  const clearClickSuppression = () => {
    doc.removeEventListener("click", suppressClick, { capture: true })
    doc.removeEventListener("pointerdown", clearClickSuppression, { capture: true })
  }
  const suppressClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    clearClickSuppression()
  }

  function move(e: PointerEvent) {
    if (phase === "finished" || e.pointerId !== pointerId) return
    const point = { x: e.clientX, y: e.clientY }

    // 桌面端可能先报 buttons=0 再补 pointerup：拖着的直接按松手处理
    if ((e.buttons & 1) === 0) {
      if (phase === "dragging") return finish("drop", point)
      return finish("cancel")
    }

    if (phase === "pending") {
      if (Math.hypot(point.x - origin.x, point.y - origin.y) <= options.distance) return
      phase = "dragging"
      doc.addEventListener("selectionchange", clearSelection)
      clearSelection()
      options.onStart(origin)
    }

    if (e.cancelable) e.preventDefault()
    options.onMove(point)
  }

  function up(e: PointerEvent) {
    if (e.pointerId !== pointerId) return
    finish(phase === "dragging" ? "drop" : "cancel", { x: e.clientX, y: e.clientY })
  }

  function pointerCancel(e: PointerEvent) {
    if (e.pointerId === pointerId) finish("cancel")
  }

  function keydown(e: KeyboardEvent) {
    if (e.key !== "Escape" || phase !== "dragging") return
    e.preventDefault()
    e.stopPropagation()
    finish("cancel")
  }

  function visibility() {
    if (doc.hidden) finish("cancel")
  }

  const cancel = () => finish("cancel")

  function finish(how: "drop" | "cancel", point?: PointerPoint) {
    if (phase === "finished") return
    const started = phase === "dragging"
    phase = "finished"
    doc.removeEventListener("pointermove", move, { capture: true })
    doc.removeEventListener("pointerup", up, { capture: true })
    doc.removeEventListener("pointercancel", pointerCancel, { capture: true })
    doc.removeEventListener("keydown", keydown, { capture: true })
    doc.removeEventListener("visibilitychange", visibility)
    win.removeEventListener("blur", cancel)
    win.removeEventListener("pagehide", cancel)
    win.removeEventListener("resize", cancel)
    doc.removeEventListener("dragstart", preventDefault)
    doc.removeEventListener("contextmenu", preventDefault)
    doc.removeEventListener("selectionchange", clearSelection)

    if (started) {
      // 松手后的那次 click 不能当成打开会话；在文档外松手时由下一次按下清掉
      doc.addEventListener("click", suppressClick, { capture: true })
      doc.addEventListener("pointerdown", clearClickSuppression, { capture: true })
    }

    try {
      if (started && how === "drop" && point) options.onDrop(point)
      else if (started) options.onCancel()
    } finally {
      options.onFinish?.(started)
    }
  }

  doc.addEventListener("pointermove", move, { passive: false, capture: true })
  doc.addEventListener("pointerup", up, { capture: true })
  doc.addEventListener("pointercancel", pointerCancel, { capture: true })
  doc.addEventListener("keydown", keydown, { capture: true })
  doc.addEventListener("visibilitychange", visibility)
  win.addEventListener("blur", cancel)
  win.addEventListener("pagehide", cancel)
  win.addEventListener("resize", cancel)
  doc.addEventListener("dragstart", preventDefault)
  doc.addEventListener("contextmenu", preventDefault)
  return { cancel }
}
