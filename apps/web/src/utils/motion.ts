/**
 * 共享运动基建。
 *
 * glideElements/elementOffsets/motionToken：FLIP 位移动画，供「旧布局 → 新布局」复用。
 * useDragReorder：pointer 跟手 + 松手惯性吸附的拖拽重排，替代原生 HTML5 DnD 的静态反馈。
 *   拖拽期间不改 DOM，只用 transform 预览；松手一次性提交 index，配合 move 动画落位。
 */

export interface FlipMotion {
  duration: number
  easing: string
}

type Offset = { x: number; y: number }

/** 元素相对锚框左上角的位置；锚框取稳定参照，外层整体平移不串进位移。 */
export function elementOffsets(anchor: HTMLElement, els: readonly HTMLElement[]): Offset[] {
  const box = anchor.getBoundingClientRect()
  return els.map((el) => {
    const rect = el.getBoundingClientRect()
    return { x: rect.left - box.left, y: rect.top - box.top }
  })
}

/**
 * 元素从旧槽位滑到新槽位；dimmed 跨越超过 dimDistance 时中段压暗。
 * from 用 elementOffsets 在数据/DOM 更新前取。
 */
export function glideElements(
  anchor: HTMLElement,
  els: readonly HTMLElement[],
  from: readonly Offset[],
  motion: FlipMotion,
  dimmed?: HTMLElement | null,
  dimDistance = 24,
): void {
  els.forEach((el) => el.getAnimations().forEach((animation) => animation.cancel()))
  const to = elementOffsets(anchor, els)

  els.forEach((el, index) => {
    const start = from[index]
    const end = to[index]

    if (!start || !end) return
    const dx = start.x - end.x
    const dy = start.y - end.y

    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    const dim = el === dimmed && Math.abs(dx) + Math.abs(dy) > dimDistance

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px)` },
        ...(dim ? [{ opacity: 0.35, offset: 0.45 }] : []),
        { transform: "none" },
      ],
      { duration: motion.duration, easing: motion.easing },
    )
  })
}

/** 从 motion token 读时长与曲线。 */
export function motionToken(el: Element, durationVar: string, easingVar: string): FlipMotion {
  const style = getComputedStyle(el)
  return {
    duration: Number.parseFloat(style.getPropertyValue(durationVar)) || 0,
    easing: style.getPropertyValue(easingVar).trim() || "ease-out",
  }
}

export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* ------------------------------------------------------------------ */
/* 拖拽重排                                                            */
/* ------------------------------------------------------------------ */

export interface DragReorderOptions {
  axis: "x" | "y"
  /** 拖动元素的父容器。 */
  container: () => HTMLElement | null | undefined
  /** 拖动元素选择器；元素须带 data-id。 */
  itemSelector: string
  /** 触发拖动的最小位移（px）。 */
  threshold?: number
  /** 松手惯性滑行系数：预测位移 = velocity * fling。 */
  fling?: number
  /** 越界橡皮筋阻尼（0~1）。 */
  rubber?: number
  /** 落位动画时长（ms）。 */
  settleMs?: number
  /** 邻项让位过渡时长（ms）。 */
  shiftMs?: number
  /**
   * 拖动中目标槽位变化时回调。默认用 transform 预览让位；
   * 返回 true 表示调用方已自己处理（如实进 DOM 重排），不再预览。
   */
  onPreview?: (id: string, toIndex: number) => boolean | void
  /**
   * 松手提交重排：拖动的 id 与目标 index。
   * continuous 模式下拖动中已通过 onPreview 实时提交，此回调只在松手时收尾，可省略。
   */
  onMove?: (id: string, toIndex: number) => void
}

interface DragState {
  id: string
  node: HTMLElement
  pointerId: number
  start: number
  base: number
  offset: number
  velocity: number
  lastT: number
  lastOffset: number
  moved: boolean
  items: HTMLElement[]
  rects: { pos: number; size: number }[]
  /** 拖动项自身尺寸：邻项让位距离。 */
  self: number
  from: number
  to: number
}

export function useDragReorder(opts: DragReorderOptions) {
  const axis = opts.axis
  const fling = opts.fling ?? 0.12
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

  /** 拖动目标的目标槽位：按拖动元素中点越过的槽位数算。 */
  function targetIndex(): number {
    const st = s!
    const fromRect = st.rects[st.from]
    const mid = st.offset + (fromRect?.size ?? 0) / 2
    let to = st.from

    if (fromRect && mid > fromRect.pos + fromRect.size) {
      for (let i = st.from + 1; i < st.rects.length; i++) {
        const r = st.rects[i]

        if (r && mid > r.pos + r.size / 2) to = i
        else break
      }
    } else {
      for (let i = st.from - 1; i >= 0; i--) {
        const r = st.rects[i]

        if (r && mid < r.pos + r.size / 2) to = i
        else break
      }
    }

    return to
  }

  /** 邻项按 from→to 让位；让位距离用拖动项自身尺寸，支持变高元素。 */
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

  /** 目标槽位变化：交给 onPreview 或默认预览。 */
  function preview(to: number) {
    const st = s!

    if (st.to === to) return
    st.to = to
    const handled = opts.onPreview?.(st.id, to) === true

    if (!handled) layoutShift()
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

    const now = performance.now()
    const dt = (now - st.lastT) / 1000
    let next = st.base + delta
    const min = st.rects[0]?.pos ?? 0
    const max = st.rects[st.rects.length - 1]?.pos ?? 0

    if (next < min) next = min + (next - min) * rubber
    else if (next > max) next = max + (next - max) * rubber

    if (dt > 0) st.velocity = st.velocity * 0.72 + ((next - st.lastOffset) / dt) * 0.28
    st.lastT = now
    st.lastOffset = next
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
      s = null
      return
    }

    const to = targetIndex()
    const landing = (st.rects[to]?.pos ?? st.offset) - st.base
    const live = st.offset - st.base
    clearShift()

    if (!prefersReducedMotion() && Math.abs(landing - live) > 0.5) {
      st.node.animate(
        [{ transform: `${translate}(${live}px)` }, { transform: `${translate}(${landing}px)` }],
        { duration: settleMs, easing: ease },
      )
    }

    st.node.classList.remove("is-drag-live")
    s = null

    if (to !== from) opts.onMove?.(id, to)
  }

  function onCancel(e: PointerEvent) {
    const st = s

    if (!st || e.pointerId !== st.pointerId) return
    detach()
    clearShift()
    st.node.style.transform = ""
    st.node.classList.remove("is-drag-live")
    s = null
  }

  function detach() {
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onCancel)
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || e.ctrlKey) return
    const node = (e.target as HTMLElement).closest<HTMLElement>(opts.itemSelector)
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
      velocity: 0,
      lastT: performance.now(),
      lastOffset: r.pos,
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
