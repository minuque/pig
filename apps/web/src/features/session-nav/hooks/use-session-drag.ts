import { computed, nextTick, onBeforeUnmount, shallowRef, type ShallowRef } from "vue"
import { prefersReducedMotion } from "@utils/motion.js"
import {
  startPointerDrag,
  type PointerDragHandle,
  type PointerPoint,
} from "@features/session-nav/hooks/use-pointer-drag.js"
import {
  dropSessions,
  markSessionDropTarget,
  sessionDropTargetAt,
} from "@features/session-nav/lib/context-drag.js"
import {
  dropVerb,
  pinnedSlot,
  planDrop,
  projectOffsets,
  sortedSlot,
  type DropPlan,
  type DropZone,
  type LayoutItem,
} from "@features/session-nav/lib/drag-plan.js"
import type { SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const DRAG_DISTANCE = 6
/** 拖起时「置顶」「收件箱」两条段名各撑开的高度。 */
const LABEL_HEIGHT = 24
/** 指针离滚动区上下沿多近开始自动滚，以及每帧最多滚多少。 */
const SCROLL_EDGE = 56
const SCROLL_MAX = 14

interface DragState {
  id: string
  session: SidebarSession
  section: SidebarSection
  /** 抽走这一行时下面的行要补的高度：行高 + 行间距。 */
  size: number
  height: number
  grab: number
  left: number
  width: number
}

function cssTime(name: string, fallback: number): number {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))
  return Number.isFinite(value) ? value : fallback
}

function cssValue(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/** 不受位移影响的视口坐标：沿 offsetParent 累加到滚动容器，再扣掉滚动量。 */
function staticTop(el: HTMLElement, container: HTMLElement): number {
  let top = 0
  let node: HTMLElement | null = el

  while (node && node !== container) {
    top += node.offsetTop
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null
  }

  const box = container.getBoundingClientRect()
  return box.top + container.clientTop + top - container.scrollTop
}

function layoutItems(container: HTMLElement | undefined): LayoutItem[] {
  if (!container) return []
  return [...container.querySelectorAll<HTMLElement>("[data-drag-key]")].map((el) => ({
    key: el.dataset.dragKey!,
    kind: (el.dataset.dragItem as LayoutItem["kind"] | undefined) ?? "row",
  }))
}

export function useSessionDrag(options: {
  list: ShallowRef<HTMLElement | undefined>
  window: ShallowRef<HTMLElement | undefined>
  shelves: ShallowRef<HTMLElement | undefined>
  sections: () => readonly SidebarSection[]
  pinnedOrder: () => readonly string[]
  commit: (id: string, plan: DropPlan) => void
}) {
  const drag = shallowRef<DragState | null>(null)
  const zone = shallowRef<DropZone | null>(null)
  const offsets = shallowRef<ReadonlyMap<string, number>>(new Map())
  const overlayTop = shallowRef(0)
  /** 指针离开列表左右边：改成把会话当引用拖到别处。 */
  const outside = shallowRef(false)
  const ghost = shallowRef<PointerPoint | null>(null)
  /** 松手那一拍：段内进出场动画让给落位动画。 */
  const releasing = shallowRef(false)
  const sorting = computed(() => drag.value !== null && drag.value.section.kind !== "working")
  const verb = computed(() =>
    drag.value && !outside.value ? dropVerb(drag.value.section.kind, zone.value) : null,
  )
  let handle: PointerDragHandle | undefined
  let last: PointerPoint | null = null
  let slot = 0
  let projected = ""
  let raf = 0

  function rowEl(id: string): HTMLElement | null {
    return (
      options.list.value?.querySelector<HTMLElement>(`.session-row[data-id="${CSS.escape(id)}"]`) ??
      null
    )
  }

  function start(sectionKey: string, id: string, event: PointerEvent): void {
    const section = options.sections().find((item) => item.key === sectionKey)
    const session = section?.sessions.find((item) => item.id === id)

    if (!section || !session) return
    handle?.cancel()
    handle = startPointerDrag(event, {
      distance: DRAG_DISTANCE,
      onStart: (origin) => void begin(section, session, origin),
      onMove: (point) => update(point),
      onDrop: (point) => drop(point),
      onCancel: () => void release({ kind: "none" }),
      onFinish: () => {
        handle = undefined
      },
    })
  }

  async function begin(section: SidebarSection, session: SidebarSession, origin: PointerPoint) {
    const row = rowEl(session.id)

    if (!row) return handle?.cancel()
    const rect = row.getBoundingClientRect()
    drag.value = {
      id: session.id,
      session,
      section,
      size: rect.height + 1,
      height: rect.height,
      grab: origin.y - rect.top,
      left: rect.left,
      width: rect.width,
    }
    overlayTop.value = rect.top
    zone.value = section.kind === "working" ? null : section.kind
    projected = ""
    last = origin
    raf = requestAnimationFrame(autoScroll)
    // 段名与空段占位要先渲染出来，投影才量得到
    await nextTick()
    update(last, true)
  }

  function update(point: PointerPoint, force = false): void {
    const d = drag.value
    const list = options.list.value
    const win = options.window.value

    if (!d || !list || !win) return
    last = point

    if (!rowEl(d.id)) return handle?.cancel()
    const listBox = list.getBoundingClientRect()
    const away = point.x < listBox.left || point.x > listBox.right

    if (away !== outside.value) {
      outside.value = away
      force = true
    }

    if (away) {
      zone.value = null
      ghost.value = point
      markSessionDropTarget(sessionDropTargetAt(point))

      if (force) project(null, undefined)
      return
    }

    ghost.value = null
    markSessionDropTarget(null)
    const top = win.getBoundingClientRect().top
    overlayTop.value = Math.min(Math.max(point.y - d.grab, top), listBox.bottom - d.height)

    if (!sorting.value) return
    const next = zoneAt(point)
    zone.value = next
    project(next, insertAfter(next), force)
  }

  function zoneAt(point: PointerPoint): DropZone | null {
    const shelves = options.shelves.value

    if (shelves && point.y >= shelves.getBoundingClientRect().top) {
      const settled = shelves.querySelector<HTMLElement>('[data-key="settled"]')
      return settled && point.y >= settled.getBoundingClientRect().top ? "settled" : null
    }

    // 段名带位移一起量：跨过它才换段，停在段名上保持原段，免得来回闪
    const divider = options.window.value
      ?.querySelector<HTMLElement>('[data-drag-key="pinned-divider"] .drag-label-inner')
      ?.getBoundingClientRect()

    if (!divider) return "active"

    if (point.y < divider.top) return "pinned"

    if (point.y > divider.bottom) return "active"
    return zone.value === "pinned" ? "pinned" : "active"
  }

  function insertAfter(next: DropZone | null): string | undefined {
    const d = drag.value!

    if (next === "pinned") return pinnedInsert(d)

    const section = options.sections().find((item) => item.kind === next)

    if (!section || (next === "settled" && !rowsRendered("settled"))) return undefined
    const rows = section.sessions.filter((item) => item.id !== d.id)
    const k = sortedSlot(rows, d.session)

    if (k === rows.length && section.shown < section.total) return undefined
    return k > 0 ? rows[k - 1]!.id : next === "settled" ? "settled-head" : "pinned-divider"
  }

  function rowsRendered(key: string): boolean {
    return !!options.list.value?.querySelector(`[data-key="${key}"] .session-row[data-id]`)
  }

  /** 置顶段按被拖行中心越过了几行定位；量的是抽走被拖行、撑开段名后的静止位置。 */
  function pinnedInsert(d: DragState): string {
    const win = options.window.value!
    const rows = [...win.querySelectorAll<HTMLElement>('[data-key="pinned"] .session-row[data-id]')]
    const from = rows.findIndex((row) => row.dataset.id === d.id)
    const center = overlayTop.value + d.height / 2
    const visible: string[] = []
    let k = 0

    for (const [index, row] of rows.entries()) {
      if (index === from) continue
      visible.push(row.dataset.id!)
      const top = staticTop(row, win) + LABEL_HEIGHT - (from !== -1 && index > from ? d.size : 0)

      if (top + row.offsetHeight / 2 < center) k = visible.length
    }

    slot = pinnedSlot(options.pinnedOrder(), visible, k)

    if (k > 0) return visible[k - 1]!
    return win.querySelector('[data-drag-key="pinned-slot"]') ? "pinned-slot" : "pinned-head"
  }

  function project(next: DropZone | null, after: string | undefined, force = false): void {
    const d = drag.value

    if (!d) return
    const key = `${outside.value}|${next}|${after}`

    if (!force && key === projected) return
    projected = key

    if (outside.value) {
      offsets.value = new Map()
      return
    }

    const base = { activeKey: d.id, insertAfter: after, size: d.size }
    offsets.value = new Map([
      ...projectOffsets({ ...base, items: layoutItems(options.window.value), label: LABEL_HEIGHT }),
      ...projectOffsets({ ...base, items: layoutItems(options.shelves.value), label: 0 }),
    ])
  }

  function scrollBoxAt(y: number): HTMLElement | undefined {
    const shelves = options.shelves.value

    if (shelves && y >= shelves.getBoundingClientRect().top) return shelves
    return options.window.value
  }

  function autoScroll(): void {
    raf = requestAnimationFrame(autoScroll)
    const point = last

    if (!point || !drag.value || outside.value) return
    const box = scrollBoxAt(point.y)

    if (!box) return
    const rect = box.getBoundingClientRect()
    const edge = Math.min(SCROLL_EDGE, rect.height / 4)
    let dy = 0

    if (point.y < rect.top + edge) dy = -Math.min(1, (rect.top + edge - point.y) / edge)
    else if (point.y > rect.bottom - edge) dy = Math.min(1, (point.y - rect.bottom + edge) / edge)

    if (!dy) return
    const before = box.scrollTop
    box.scrollTop += Math.ceil(Math.abs(dy) * SCROLL_MAX) * Math.sign(dy)

    if (box.scrollTop !== before) update(point, true)
  }

  function drop(point: PointerPoint): void {
    const d = drag.value

    if (!d) return
    update(point)

    if (outside.value) {
      const target = sessionDropTargetAt(point)

      if (target) dropSessions(target, [{ id: d.id, title: d.session.title }])
      void release({ kind: "none" })
      return
    }

    const plan = planDrop({
      id: d.id,
      from: d.section.kind,
      zone: zone.value,
      pinnedOrder: options.pinnedOrder(),
      slot,
    })

    void release(plan)
  }

  function items(): HTMLElement[] {
    return [options.window.value, options.shelves.value].flatMap((box) =>
      box ? [...box.querySelectorAll<HTMLElement>("[data-drag-key]")] : [],
    )
  }

  /** 记下松手时各行所在，提交后从那里滑到新位置；被拖行从浮层的位置落下去。 */
  async function release(plan: DropPlan): Promise<void> {
    const d = drag.value

    cancelAnimationFrame(raf)
    markSessionDropTarget(null)

    if (!d) return
    const tops = new Map(items().map((el) => [el.dataset.dragKey!, el.getBoundingClientRect().top]))

    if (!outside.value) tops.set(d.id, overlayTop.value)
    releasing.value = true
    drag.value = null
    zone.value = null
    offsets.value = new Map()
    outside.value = false
    ghost.value = null
    last = null

    if (plan.kind !== "none") options.commit(d.id, plan)
    await nextTick()

    if (!prefersReducedMotion()) {
      const timing = {
        duration: cssTime("--duration-fast", 150),
        easing: cssValue("--ease-out", "ease-out"),
      }

      for (const el of items()) {
        const before = tops.get(el.dataset.dragKey!)
        const delta = before === undefined ? 0 : before - el.getBoundingClientRect().top

        if (Math.abs(delta) < 0.5) continue
        el.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }],
          timing,
        )
      }
    }

    releasing.value = false
  }

  onBeforeUnmount(() => {
    handle?.cancel()
    cancelAnimationFrame(raf)
  })
  return { drag, zone, offsets, overlayTop, outside, ghost, releasing, sorting, verb, start }
}
