import { nextTick } from "vue"
import { isRTL, keepFocus, type PrimitiveContext, type ReorderMessage } from "@ui-sdk/core"
import {
  computeClosedMetrics,
  computeItemMotions,
  computeLiftOffset,
  computeLinePosition,
  moveKeyInOrder,
  type AxisRect,
  type ClosedMetrics,
  type DragLiftSide,
  type DragOrientation,
} from "../../core/drag-physics.js"
import {
  applyItemMotions,
  clearItemStyles,
  createDropHint,
  measureContainerRects,
  prefersReducedMotion,
  runFlipSettle,
  setKeyboardDragVars,
  type DropHintHandle,
  type FlipEntry,
} from "../../core/drag-stage.js"
import type { SortableChange, SortableListOptions, SortableState } from "./sortable-controller.js"

type KeyboardSession = {
  mounted: string[]
  elements: HTMLElement[]
  rects: AxisRect[]
  containerRect: AxisRect
  closed: ClosedMetrics
  reversed: boolean
}

export function createSortableKeyboard(deps: {
  context: PrimitiveContext<SortableListOptions, SortableState, "root" | "item" | "handle">
  change: SortableChange
  itemEls: ReadonlyMap<string, HTMLElement>
  handleEls: ReadonlyMap<string, HTMLElement>
  rootEl: () => HTMLElement | undefined
  orientation: () => DragOrientation
  amplitude: () => number
  liftSide: () => DragLiftSide
  mountedEntries: () => { keys: string[]; elements: HTMLElement[] }
  cancelPendingSettle: () => void
  setCancelSettle: (cleanup: (() => void) | undefined) => void
  say: (type: ReorderMessage["type"], key: string, order: readonly string[]) => void
}) {
  let dropHint: DropHintHandle | undefined
  let session: KeyboardSession | undefined

  function reset() {
    dropHint?.destroy()
    dropHint = undefined
    session = undefined
  }

  function scheduleFlip(beforeAll: readonly FlipEntry[], reduced: boolean) {
    if (reduced) {
      clearItemStyles(beforeAll.map((entry) => entry.el))
      return
    }

    let cancelled = false
    let stopFlip: (() => void) | undefined

    deps.setCancelSettle(() => {
      cancelled = true
      stopFlip?.()
    })

    void nextTick(() => {
      if (cancelled) return
      stopFlip = runFlipSettle(beforeAll, false, () => {
        if (!cancelled) deps.setCancelSettle(undefined)
      })
    })
  }

  function grab(key: string): boolean {
    const rootEl = deps.rootEl()
    const itemEl = deps.itemEls.get(key)

    if (!itemEl || !rootEl || !deps.context.store.get().value.includes(key)) return false
    deps.cancelPendingSettle()
    const entry = deps.mountedEntries()
    const dragIndex = entry.keys.indexOf(key)

    if (dragIndex < 0) return false
    const orient = deps.orientation()
    const reduced = prefersReducedMotion()
    const reversed = orient === "horizontal" && isRTL(rootEl)
    const measured = measureContainerRects(rootEl, entry.elements, orient)
    const closed = computeClosedMetrics(measured.items, dragIndex, reversed)

    session = {
      mounted: entry.keys,
      elements: entry.elements,
      rects: measured.items,
      containerRect: measured.containerRect,
      closed,
      reversed,
    }
    dropHint = createDropHint(rootEl, orient)
    deps.context.store.set({
      moving: {
        key,
        originIndex: dragIndex,
        targetGap: dragIndex,
        pointer: false,
        outside: false,
        reduced,
      },
    })

    if (!reduced) {
      const box = itemEl.getBoundingClientRect()

      setKeyboardDragVars(
        itemEl,
        computeLiftOffset(
          orient,
          { width: box.width, height: box.height },
          deps.liftSide(),
          reversed,
        ),
      )
      applyItemMotions(
        entry.elements,
        computeItemMotions(entry.elements.length, dragIndex, closed.stride, dragIndex, {
          amplitude: deps.amplitude(),
          reducedMotion: false,
          reversed,
        }),
        orient,
        dragIndex,
      )
    }

    deps.say("grab", key, deps.context.store.get().value)
    return true
  }

  function keydown(event: KeyboardEvent, key: string): boolean {
    const current = deps.context.store.get().moving

    if (event.defaultPrevented || current?.pointer) return Boolean(current)

    const modified = event.altKey || event.ctrlKey || event.metaKey

    if (!current) {
      if (modified || (event.key !== " " && event.key !== "Enter") || !grab(key)) return false
      event.preventDefault()
      return true
    }

    if (!session) return true

    const orient = deps.orientation()
    const { mounted, elements, rects, containerRect, closed, reversed } = session
    const itemEl = deps.itemEls.get(current.key)

    if (event.key === "Tab" || event.key === "Escape") {
      const escape = event.key === "Escape"

      if (escape) {
        event.preventDefault()
        event.stopPropagation()
      }

      reset()
      const beforeAll = elements.map((el) => ({ el, before: el.getBoundingClientRect() }))

      clearItemStyles(itemEl ? [itemEl] : [])
      deps.context.store.set({ moving: null })
      deps.say("cancel", current.key, deps.context.store.get().value)
      scheduleFlip(beforeAll, current.reduced)

      if (escape) keepFocus(() => deps.handleEls.get(current.key) ?? deps.itemEls.get(current.key))
      return true
    }

    if (event.key === " " || event.key === "Enter") {
      event.preventDefault()
      const isOwnSlot = current.targetGap === current.originIndex
      const beforeAll = elements.map((el) => ({ el, before: el.getBoundingClientRect() }))

      reset()

      if (isOwnSlot) {
        clearItemStyles(itemEl ? [itemEl] : [])
        deps.context.store.set({ moving: null })
        deps.say("drop", current.key, deps.context.store.get().value)
        scheduleFlip(beforeAll, current.reduced)
        keepFocus(() => deps.handleEls.get(current.key) ?? deps.itemEls.get(current.key))
        return true
      }

      const nextOrder = moveKeyInOrder(
        deps.context.store.get().value,
        mounted,
        current.key,
        current.targetGap,
      )
      const accepted =
        nextOrder !== deps.context.store.get().value &&
        deps.change("value", nextOrder, { reason: "move-key", event })

      clearItemStyles(itemEl ? [itemEl] : [])
      deps.context.store.set({ moving: null })
      deps.say(
        accepted ? "drop" : "cancel",
        current.key,
        accepted ? nextOrder : deps.context.store.get().value,
      )
      scheduleFlip(beforeAll, current.reduced)
      keepFocus(() => deps.handleEls.get(current.key) ?? deps.itemEls.get(current.key))
      return true
    }

    if (!modified) {
      let nextGap: number | undefined

      if (orient === "vertical") {
        if (event.key === "ArrowUp") nextGap = current.targetGap - 1
        else if (event.key === "ArrowDown") nextGap = current.targetGap + 1
      } else {
        if (event.key === "ArrowLeft") nextGap = current.targetGap + (reversed ? 1 : -1)
        else if (event.key === "ArrowRight") nextGap = current.targetGap + (reversed ? -1 : 1)
      }

      if (event.key === "Home") nextGap = 0
      else if (event.key === "End") nextGap = closed.remaining.length

      if (nextGap !== undefined) {
        event.preventDefault()
        const clamped = Math.max(0, Math.min(closed.remaining.length, nextGap))

        if (clamped !== current.targetGap) {
          deps.context.store.set({ moving: { ...current, targetGap: clamped } })
          const line = computeLinePosition(
            closed.remaining,
            clamped,
            closed.interGap,
            containerRect,
            reversed,
          )

          if (clamped === current.originIndex) dropHint?.hide()
          else if (line) dropHint?.show(line, current.reduced)

          applyItemMotions(
            elements,
            computeItemMotions(elements.length, current.originIndex, closed.stride, clamped, {
              amplitude: deps.amplitude(),
              reducedMotion: current.reduced,
              reversed,
            }),
            orient,
            current.originIndex,
          )

          if (!current.reduced && itemEl) {
            const origRect = rects[current.originIndex]!
            const lift = computeLiftOffset(
              orient,
              { width: itemEl.offsetWidth, height: itemEl.offsetHeight },
              deps.liftSide(),
              reversed,
            )
            const axisShift =
              clamped === current.originIndex || !line
                ? 0
                : line.axis - (origRect.start + origRect.size / 2)

            setKeyboardDragVars(
              itemEl,
              orient === "vertical"
                ? { x: lift.x, y: axisShift, scale: lift.scale }
                : { x: axisShift, y: lift.y, scale: lift.scale },
            )
          }

          deps.say(
            "move",
            current.key,
            moveKeyInOrder(deps.context.store.get().value, mounted, current.key, clamped),
          )
        }
      }
    }

    return true
  }

  return { keydown, reset }
}
