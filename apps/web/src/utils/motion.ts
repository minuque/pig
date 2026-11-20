export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches
}

export interface DragReorderOptions {
  axis: "x" | "y"
  container: () => HTMLElement | null | undefined
  itemSelector: string
  handleSelector?: string
  threshold?: number
  rubber?: number
  settleMs?: number
  shiftMs?: number
  onPreview?: (id: string, toIndex: number) => boolean | void
  onMove?: (id: string, toIndex: number) => void
}

interface DragState {
  id: string
  node: HTMLElement
  pointerId: number
  start: number
  base: number
  offset: number
  moved: boolean
  items: HTMLElement[]
  rects: { pos: number; size: number }[]
  self: number
  from: number
  to: number
}

export function useDragReorder(opts: DragReorderOptions) {
  const axis = opts.axis
  const rubber = opts.rubber ?? 0.35
  const settleMs = opts.settleMs ?? 260
  const shiftMs = opts.shiftMs ?? 180
  const threshold = opts.threshold ?? 5
  const prop = axis === "x" ? "left" : "top"
  const sizeProp = axis === "x" ? "width" : "height"
  const client = axis === "x" ? "clientX" : "clientY"
  const translate = axis === "x" ? "translateX" : "translateY"
  const ease = "cubic-bezier(.22,1,.36,1)"
  let s: DragState | null = null

  function list(): HTMLElement[] {
    const c = opts.container()
    return c ? [...c.querySelectorAll<HTMLElement>(opts.itemSelector)] : []
  }

  function measure() {
    const its = list()
    const rects = its.map((el) => {
      const r = el.getBoundingClientRect()
      return { pos: r[prop], size: r[sizeProp] }
    })
    return { its, rects }
  }

  function targetIndex(): number {
    const st = s!
    let to = st.from

    for (let i = st.from + 1; i < st.rects.length; i++) {
      const r = st.rects[i]

      if (r && st.offset + st.self > r.pos + r.size / 2) to = i
      else break
    }

    if (to !== st.from) return to

    for (let i = st.from - 1; i >= 0; i--) {
      const r = st.rects[i]

      if (r && st.offset < r.pos + r.size / 2) to = i
      else break
    }

    return to
  }

  function layoutShift() {
    const st = s!
    st.items.forEach((el, i) => {
      if (i === st.from) return
      let shift = 0

      if (st.to > st.from && i > st.from && i <= st.to) shift = -st.self
      else if (st.to < st.from && i < st.from && i >= st.to) shift = st.self
      el.style.transition = `transform ${shiftMs}ms ${ease}`
      el.style.transform = shift ? `${translate}(${shift}px)` : ""
    })
  }

  function preview(to: number) {
    const st = s!

    if (st.to === to) return
    st.to = to
    const handled = opts.onPreview?.(st.id, to) === true

    if (!handled) layoutShift()
  }

  /** 拖拽用的 transform/transition 兜底清理：重排后 Vue 复用节点，残留位移要清。 */
  function sweep() {
    const c = opts.container()

    if (!c) return
    requestAnimationFrame(() => {
      c.querySelectorAll<HTMLElement>(opts.itemSelector).forEach((el) => {
        el.style.transition = ""
        el.style.transform = ""
      })
    })
  }

  function clearShift() {
    s?.items.forEach((el) => {
      if (el === s!.node) return
      el.style.transition = ""
      el.style.transform = ""
    })
  }

  function onMove(e: PointerEvent) {
    const st = s

    if (!st || e.pointerId !== st.pointerId) return
    const delta = e[client] - st.start

    if (!st.moved && Math.abs(delta) < threshold) return
    st.moved = true

    let next = st.base + delta
    const min = st.rects[0]?.pos ?? 0
    const last = st.rects[st.rects.length - 1]
    const max = last ? last.pos + last.size - st.self : 0

    if (next < min) next = min + (next - min) * rubber
    else if (next > max) next = max + (next - max) * rubber

    st.offset = next

    preview(targetIndex())
    st.node.style.transform = `${translate}(${next - st.base}px)`
  }

  function onUp(e: PointerEvent) {
    const st = s

    if (!st || e.pointerId !== st.pointerId) return
    detach()
    const { id, from, moved } = st

    if (!moved) {
      clearShift()
      st.node.classList.remove("is-drag-live")
      s = null
      return
    }

    // 拖过之后松手会在起点元素上补一次 click，吞掉它，免得整项可拖时误触按钮
    window.addEventListener("click", swallowClick, { capture: true, once: true })
    setTimeout(() => window.removeEventListener("click", swallowClick, { capture: true }))
    const to = targetIndex()
    const landing = (st.rects[to]?.pos ?? st.offset) - st.base
    const live = st.offset - st.base
    st.node.classList.remove("is-drag-live")
    clearShift()
    st.node.style.transform = ""

    const animation =
      !prefersReducedMotion() && Math.abs(landing - live) > 0.5
        ? st.node.animate(
            [{ transform: `${translate}(${live}px)` }, { transform: `${translate}(${landing}px)` }],
            { duration: settleMs, easing: ease },
          )
        : undefined

    s = null

    if (to !== from) opts.onMove?.(id, to)

    if (to !== from) animation?.cancel()
    sweep()
  }

  function onCancel(e: PointerEvent) {
    const st = s

    if (!st || e.pointerId !== st.pointerId) return
    detach()
    clearShift()
    st.node.style.transform = ""
    st.node.classList.remove("is-drag-live")
    s = null
    sweep()
  }

  function swallowClick(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  function detach() {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.ctrlKey) return
    const target = e.target as HTMLElement

    if (opts.handleSelector && !target.closest(opts.handleSelector)) return
    const node = target.closest<HTMLElement>(opts.itemSelector)
    const c = opts.container()

    if (!node || !c || !c.contains(node)) return
    const id = node.dataset.id

    if (!id) return
    const { its, rects } = measure()
    const from = its.indexOf(node)

    if (from < 0) return
    const r = rects[from]

    if (!r) return

    s = {
      id,
      node,
      pointerId: e.pointerId,
      start: e[client],
      base: r.pos,
      offset: r.pos,
      moved: false,
      items: its,
      rects,
      self: r.size,
      from,
      to: from,
    }
    node.classList.add("is-drag-live")
    window.addEventListener("pointermove", onMove, { passive: true })
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onCancel)
  }

  function attach(el: HTMLElement) {
    el.addEventListener("pointerdown", onPointerDown)
    return () => el.removeEventListener("pointerdown", onPointerDown)
  }

  return { attach, detach }
}
