import { nextTick } from "vue"
import {
  announce,
  bindDrag,
  createAutoScroll,
  dragThreshold,
  isRTL,
  labelOf,
  reorderMessage,
  type ChangeDetails,
  type PrimitiveContext,
  type ReorderMessage,
  type ReorderReason,
} from "@ui-sdk/core"
import {
  computeClosedMetrics,
  computeItemMotions,
  computeLinePosition,
  findDropGap,
  isPointOutsideRect,
  moveKeyInOrder,
  OUTSIDE_SLOP_PX,
  RIPPLE_AMPLITUDE,
  type AxisRect,
  type ClosedMetrics,
  type DragItemDensity,
  type DragLiftSide,
  type DragOrientation,
} from "../../core/drag-physics.js"
import {
  acquireGlobalDragging,
  applyItemMotions,
  clearItemStyles,
  createDropHint,
  createLiftedPreview,
  measureContainerRects,
  pointerToContainerAxis,
  prefersReducedMotion,
  runFlipSettle,
  springItemsBack,
  type DropHintHandle,
  type LiftedPreviewHandle,
} from "../../core/drag-stage.js"
import { createSortableKeyboard } from "./sortable-keyboard.js"

export type SortableListOptions = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[], details: ChangeDetails<ReorderReason>) => void
  orientation?: DragOrientation
  density?: DragItemDensity
  liftSide?: DragLiftSide
  itemLabel?: (key: string) => string | undefined
  message?: (message: ReorderMessage) => string
}

export type SortableMoving = {
  key: string
  originIndex: number
  targetGap: number
  pointer: boolean
  outside: boolean
  reduced: boolean
}

export type SortableState = {
  value: string[]
  moving: SortableMoving | null
  settling: string | null
}

export type SortableChange = (
  key: "value",
  value: string[],
  details: { reason: ReorderReason; event?: Event | undefined },
) => boolean

export function createSortableController(
  context: PrimitiveContext<SortableListOptions, SortableState, "root" | "item" | "handle">,
  change: SortableChange,
) {
  const itemEls = new Map<string, HTMLElement>()
  const handleEls = new Map<string, HTMLElement>()
  let rootEl: HTMLElement | undefined
  let stopDrag: (() => void) | undefined
  let releaseCursor: (() => void) | undefined
  let stopScroll: (() => void) | undefined
  let dropHint: DropHintHandle | undefined
  let preview: LiftedPreviewHandle | undefined
  let cancelSettle: (() => void) | undefined

  const orientation = (): DragOrientation => context.options().orientation ?? "vertical"
  const amplitude = () => RIPPLE_AMPLITUDE[context.options().density ?? "card"]
  const liftSide = (): DragLiftSide => context.options().liftSide ?? "end"

  function say(type: ReorderMessage["type"], key: string, order: readonly string[]) {
    const el = itemEls.get(key)
    const label = context.options().itemLabel?.(key) ?? (el ? labelOf(el) : key)
    const position = Math.max(1, order.indexOf(key) + 1)
    const msg: ReorderMessage = { type, key, label, count: 1, position, total: order.length }
    const text = context.options().message ? context.options().message!(msg) : reorderMessage(msg)

    announce(text, { priority: "assertive" })
  }

  function mountedEntries(): { keys: string[]; elements: HTMLElement[] } {
    const keys: string[] = []
    const elements: HTMLElement[] = []

    for (const key of context.store.get().value) {
      const el = itemEls.get(key)

      if (!el || !el.isConnected) continue
      keys.push(key)
      elements.push(el)
    }

    return { keys, elements }
  }

  function cancelPendingSettle() {
    cancelSettle?.()
    cancelSettle = undefined
    preview?.destroy()
    preview = undefined
    dropHint?.destroy()
    dropHint = undefined

    if (context.store.get().settling !== null) context.store.set({ settling: null })
  }

  const keyboard = createSortableKeyboard({
    context,
    change,
    itemEls,
    handleEls,
    rootEl: () => rootEl,
    orientation,
    amplitude,
    liftSide,
    mountedEntries,
    cancelPendingSettle,
    setCancelSettle: (cleanup) => {
      cancelSettle = cleanup
    },
    say,
  })

  function cleanupAll() {
    stopDrag?.()
    stopDrag = undefined
    stopScroll?.()
    stopScroll = undefined
    releaseCursor?.()
    releaseCursor = undefined
    keyboard.reset()
    cancelPendingSettle()
    clearItemStyles(itemEls.values())
  }

  context.onDestroy(cleanupAll)

  function pointerdown(event: PointerEvent, key: string) {
    if (
      event.button !== 0 ||
      (!event.isPrimary && event.pointerType !== "mouse" && event.pointerType !== "") ||
      event.defaultPrevented ||
      context.store.get().moving
    )
      return

    const itemEl = itemEls.get(key)

    if (!itemEl || !rootEl || !context.store.get().value.includes(key)) return

    const downPoint = { x: event.clientX, y: event.clientY }
    let active = false
    let mounted: string[] = []
    let elements: HTMLElement[] = []
    let dragIndex = -1
    let reversed = false
    let closed: ClosedMetrics | undefined
    let containerRect: AxisRect | undefined
    let lastPoint = { ...downPoint }
    let lastGap = -1
    let lastOutside = false

    function updateAt(x: number, y: number) {
      if (!active || !rootEl || !closed || !containerRect) return
      const orient = orientation()
      const reduced = context.store.get().moving?.reduced ?? false
      const outside = isPointOutsideRect({ x, y }, rootEl.getBoundingClientRect(), OUTSIDE_SLOP_PX)

      if (outside) {
        dropHint?.hide()

        if (!lastOutside || lastGap !== -1) {
          applyItemMotions(
            elements,
            computeItemMotions(elements.length, dragIndex, closed.stride, null, {
              amplitude: amplitude(),
              reducedMotion: reduced,
              reversed,
            }),
            orient,
            dragIndex,
          )
          lastOutside = true
          lastGap = -1
          const moving = context.store.get().moving

          if (moving) context.store.set({ moving: { ...moving, outside: true } })
        }

        return
      }

      const gap = findDropGap(
        closed.remaining,
        pointerToContainerAxis(rootEl, { x, y }, orient),
        reversed,
      )

      if (!lastOutside && gap === lastGap) return
      lastOutside = false
      lastGap = gap

      if (gap === dragIndex) {
        dropHint?.hide()
      } else {
        const line = computeLinePosition(
          closed.remaining,
          gap,
          closed.interGap,
          containerRect,
          reversed,
        )

        if (line) dropHint?.show(line, reduced)
      }

      applyItemMotions(
        elements,
        computeItemMotions(elements.length, dragIndex, closed.stride, gap, {
          amplitude: amplitude(),
          reducedMotion: reduced,
          reversed,
        }),
        orient,
        dragIndex,
      )
      const moving = context.store.get().moving

      if (moving) context.store.set({ moving: { ...moving, targetGap: gap, outside: false } })

      say("move", key, moveKeyInOrder(context.store.get().value, mounted, key, gap))
    }

    const scroller = createAutoScroll({
      ignore: () => itemEls.get(key),
      onScroll: () => updateAt(lastPoint.x, lastPoint.y),
    })

    stopDrag = bindDrag(itemEl, event, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart() {
        keyboard.reset()
        cancelPendingSettle()
        const entry = mountedEntries()

        mounted = entry.keys
        elements = entry.elements
        dragIndex = mounted.indexOf(key)

        if (dragIndex < 0 || !rootEl) {
          stopDrag = undefined
          return false
        }

        const reduced = prefersReducedMotion()
        const orient = orientation()

        reversed = orient === "horizontal" && isRTL(rootEl)
        const measured = measureContainerRects(rootEl, elements, orient)

        containerRect = measured.containerRect
        closed = computeClosedMetrics(measured.items, dragIndex, reversed)
        lastGap = dragIndex
        lastOutside = false
        active = true

        if (!reduced) {
          preview = createLiftedPreview(itemEl, {
            start: downPoint,
            orientation: orient,
            liftSide: liftSide(),
          })
        }

        releaseCursor = acquireGlobalDragging()
        stopScroll = scroller.stop
        dropHint = createDropHint(rootEl, orient)
        context.store.set({
          moving: {
            key,
            originIndex: dragIndex,
            targetGap: dragIndex,
            pointer: true,
            outside: false,
            reduced,
          },
        })

        if (!reduced) {
          applyItemMotions(
            elements,
            computeItemMotions(elements.length, dragIndex, closed.stride, dragIndex, {
              amplitude: amplitude(),
              reducedMotion: false,
              reversed,
            }),
            orient,
            dragIndex,
          )
        }

        say("grab", key, context.store.get().value)
        return true
      },
      onMove({ x, y, event: moveEvent }) {
        moveEvent.preventDefault()
        lastPoint = { x, y }
        preview?.move(x, y)
        scroller.update(x, y)
        updateAt(x, y)
      },
      onEnd(endEvent, canceled) {
        stopDrag = undefined

        if (!active) return
        active = false
        stopScroll?.()
        stopScroll = undefined
        releaseCursor?.()
        releaseCursor = undefined
        dropHint?.hide()

        const current = context.store.get().moving
        const reduced = current?.reduced ?? prefersReducedMotion()
        const targetGap = current?.targetGap ?? dragIndex
        const outside = current?.outside ?? false
        const isOwnSlot = targetGap === dragIndex
        const shouldCommit = !canceled && !outside && !isOwnSlot
        const siblings = elements.filter((_, idx) => idx !== dragIndex)
        const beforeEntries = siblings.map((el) => ({ el, before: el.getBoundingClientRect() }))
        const activePreview = preview
        const activeHint = dropHint

        preview = undefined
        dropHint = undefined

        const settle = (committed: boolean) => {
          if (reduced || !activePreview) {
            activePreview?.destroy()
            activeHint?.destroy()
            clearItemStyles(elements)
            context.store.set({ moving: null, settling: null })
            return
          }

          let cancelled = false
          let stopFlip: (() => void) | undefined

          cancelSettle = () => {
            cancelled = true
            stopFlip?.()
            activePreview.destroy()
            activeHint?.destroy()
          }

          context.store.set({ moving: null, settling: key })
          void nextTick(() => {
            if (cancelled) return
            stopFlip = committed
              ? runFlipSettle(beforeEntries, false)
              : springItemsBack(siblings, false)
            const landed = itemEls.get(key)
            const rect = landed && landed.isConnected ? landed.getBoundingClientRect() : null

            activePreview.settleTo(rect, {
              onDone: () => {
                if (cancelled) return
                if (context.store.get().settling === key) context.store.set({ settling: null })
                activeHint?.destroy()
                cancelSettle = undefined
              },
            })
          })
        }

        if (shouldCommit) {
          const nextOrder = moveKeyInOrder(context.store.get().value, mounted, key, targetGap)
          const accepted =
            nextOrder !== context.store.get().value &&
            change("value", nextOrder, { reason: "drag", event: endEvent })

          if (accepted) {
            say("drop", key, nextOrder)
            settle(true)
            return
          }

          say("cancel", key, context.store.get().value)
          settle(false)
          return
        }

        say(canceled || outside ? "cancel" : "drop", key, context.store.get().value)
        settle(false)
      },
    })
  }

  return {
    orientation,
    bindRoot(el: HTMLElement) {
      rootEl = el
      return () => {
        if (rootEl === el) rootEl = undefined
      }
    },
    bindItem(el: HTMLElement, key: string) {
      itemEls.set(key, el)
      return () => {
        if (itemEls.get(key) === el) itemEls.delete(key)
      }
    },
    bindHandle(el: HTMLElement, key: string) {
      handleEls.set(key, el)
      return () => {
        if (handleEls.get(key) === el) handleEls.delete(key)
      }
    },
    pointerdown,
    keydown: keyboard.keydown,
    move(key: string, index: number) {
      const order = context.store.get().value

      if (!order.includes(key)) return false
      const rest = order.filter((item) => item !== key)
      const clamped = Math.max(0, Math.min(rest.length, index))

      rest.splice(clamped, 0, key)

      if (rest.every((item, i) => item === order[i])) return false

      if (!change("value", rest, { reason: "imperative" })) return false
      say("drop", key, rest)
      return true
    },
  }
}
