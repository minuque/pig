import { nextTick } from "vue"
import {
  announce,
  bindDrag,
  createAutoScroll,
  dragThreshold,
  labelOf,
  transferMessage,
  type PrimitiveContext,
  type TransferDraft,
  type TransferLists,
  type TransferMessage,
} from "@ui-sdk/core"
import {
  computeItemMotions,
  computeLinePosition,
  findDropGap,
  RIPPLE_AMPLITUDE,
  type DragLiftSide,
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
  type DropHintHandle,
  type FlipEntry,
  type LiftedPreviewHandle,
} from "../../core/drag-stage.js"
import {
  isOutsideBounds,
  listAt,
  listWith,
  measureList,
  sameLists,
  settleTransfer,
  transferred,
  type TransferChange,
  type TransferChangeDetails,
  type TransferListMetrics,
  type TransferListsOptions,
  type TransferState,
} from "./transfer-helpers.js"

export type { TransferChangeDetails, TransferListsOptions, TransferState }

export function createTransferController(
  context: PrimitiveContext<TransferListsOptions, TransferState, "root" | "list" | "item">,
  change: TransferChange,
) {
  const options = () => context.options()
  const listEls = new Map<string, HTMLElement>()
  const itemEls = new Map<string, HTMLElement>()
  const hints = new Map<string, DropHintHandle>()
  let stopDrag: (() => void) | undefined
  let stopScroll: (() => void) | undefined
  let releaseCursor: (() => void) | undefined
  let preview: LiftedPreviewHandle | undefined
  let cancelSettle: (() => void) | undefined

  const amplitude = () => RIPPLE_AMPLITUDE[options().density ?? "card"]
  const liftSide = (): DragLiftSide => options().liftSide ?? "end"

  function say(type: TransferMessage["type"], key: string, current: TransferLists, list?: string) {
    const el = itemEls.get(key)
    const resolvedList = list ?? listWith(current, key) ?? ""
    const items = current[resolvedList] ?? []
    const msg: TransferMessage = {
      type,
      key,
      label: options().itemLabel?.(key) ?? (el ? labelOf(el) : key),
      list: options().listLabel?.(resolvedList) ?? resolvedList,
      position: Math.max(1, items.indexOf(key) + 1),
      total: items.length,
    }
    const text = options().message ? options().message!(msg) : transferMessage(msg)

    announce(text, { priority: "assertive" })
  }

  function hideAllHints() {
    for (const hint of hints.values()) hint.hide()
  }

  function destroyHints() {
    for (const hint of hints.values()) hint.destroy()
    hints.clear()
  }

  function cancelPendingSettle() {
    cancelSettle?.()
    cancelSettle = undefined
    preview?.destroy()
    preview = undefined
    destroyHints()

    if (context.store.get().settling !== null) context.store.set({ settling: null })
  }

  function pointerdown(event: PointerEvent, key: string) {
    if (
      event.button !== 0 ||
      (!event.isPrimary && event.pointerType !== "mouse" && event.pointerType !== "") ||
      event.defaultPrevented ||
      context.store.get().moving ||
      options().disabled?.(key)
    )
      return

    const startEl = itemEls.get(key)
    const from = listWith(context.store.get().value, key)

    if (!startEl || from === undefined) return

    const downPoint = { x: event.clientX, y: event.clientY }
    let active = false
    let measured = false
    let reduced = false
    let fromIndex = -1
    let lastPoint = { ...downPoint }
    let targetList: string | null = null
    let targetGap: number | null = null
    const metricsByList = new Map<string, TransferListMetrics>()

    function measureAllLists() {
      metricsByList.clear()
      const current = context.store.get().value

      for (const [listName, el] of listEls) {
        if (!el.isConnected) continue
        metricsByList.set(listName, measureList(current[listName] ?? [], el, itemEls, key))
      }

      const fromMetrics = metricsByList.get(from!)

      fromIndex = fromMetrics ? fromMetrics.keys.indexOf(key) : -1
      measured = true

      if (!reduced && fromMetrics && fromIndex >= 0) {
        applyItemMotions(
          fromMetrics.elements,
          computeItemMotions(
            fromMetrics.elements.length,
            fromIndex,
            fromMetrics.closed.stride,
            null,
            {
              amplitude: amplitude(),
              reducedMotion: false,
            },
          ),
          "vertical",
          fromIndex,
        )
      }
    }

    function relaxOtherLists(activeList: string | null) {
      for (const [listName, metrics] of metricsByList) {
        if (listName === activeList) continue
        hints.get(listName)?.hide()
        const dragIndex = listName === from ? fromIndex : -1

        applyItemMotions(
          metrics.elements,
          computeItemMotions(metrics.elements.length, dragIndex, metrics.closed.stride, null, {
            amplitude: amplitude(),
            reducedMotion: reduced,
          }),
          "vertical",
          dragIndex,
        )
      }
    }

    function clearTarget() {
      relaxOtherLists(null)

      if (targetList === null && targetGap === null) return
      targetList = null
      targetGap = null
      context.store.set({ to: null })
    }

    function track(x: number, y: number) {
      if (!active) return

      if (!measured) measureAllLists()

      if (isOutsideBounds(listEls, options().bounds?.(), x, y)) {
        clearTarget()
        return
      }

      const hit = listAt(listEls, x, y)
      const accepted = Boolean(hit && (options().accepts?.(key, from!, hit) ?? true))

      if (!accepted || !hit) {
        clearTarget()
        return
      }

      const canReorder = options().reorderable?.(hit, key) ?? true
      const hitMetrics = metricsByList.get(hit)

      if (!canReorder || !hitMetrics) {
        relaxOtherLists(null)

        if (targetList !== hit || targetGap !== 0) {
          targetList = hit
          targetGap = 0
          context.store.set({ to: hit })
          say("move", key, transferred(context.store.get().value, key, hit, 0), hit)
        }

        return
      }

      if (hitMetrics.closed.remaining.length === 0) {
        hitMetrics.containerRect = measureContainerRects(
          hitMetrics.el,
          [],
          "vertical",
        ).containerRect
      }

      const axis = pointerToContainerAxis(hitMetrics.el, { x, y }, "vertical")
      const gap = findDropGap(hitMetrics.closed.remaining, axis)

      if (targetList === hit && targetGap === gap) return

      relaxOtherLists(hit)
      const dragIndex = hit === from ? fromIndex : -1
      const isOwnSlot = hit === from && gap === fromIndex

      if (isOwnSlot) {
        hints.get(hit)?.hide()
      } else {
        let hint = hints.get(hit)

        if (!hint) {
          hint = createDropHint(hitMetrics.el, "vertical")
          hints.set(hit, hint)
        }

        const line = computeLinePosition(
          hitMetrics.closed.remaining,
          gap,
          hitMetrics.closed.interGap,
          hitMetrics.containerRect,
        )

        if (line) hint.show(line, reduced)
      }

      applyItemMotions(
        hitMetrics.elements,
        computeItemMotions(
          hitMetrics.elements.length,
          dragIndex,
          hitMetrics.closed.stride,
          isOwnSlot ? null : gap,
          { amplitude: amplitude(), reducedMotion: reduced },
        ),
        "vertical",
        dragIndex,
      )

      targetList = hit
      targetGap = gap
      context.store.set({ to: hit })
      say("move", key, transferred(context.store.get().value, key, hit, gap), hit)
    }

    const scroller = createAutoScroll({
      ignore: () => itemEls.get(key),
      onScroll: () => track(lastPoint.x, lastPoint.y),
    })

    stopDrag = bindDrag(startEl, event, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onStart() {
        cancelPendingSettle()
        const currentLists = context.store.get().value

        if (listWith(currentLists, key) !== from) {
          stopDrag = undefined
          return false
        }

        reduced = prefersReducedMotion()
        active = true

        if (!reduced) {
          preview = createLiftedPreview(startEl, {
            start: downPoint,
            orientation: "vertical",
            liftSide: liftSide(),
          })
        }

        releaseCursor = acquireGlobalDragging()
        stopScroll = scroller.stop
        context.store.set({
          moving: { key, from: from!, lists: currentLists, pointer: true },
          to: null,
          reduced,
        })
        say("grab", key, currentLists, from)
        void nextTick(() => {
          if (active) measureAllLists()
        })
        return true
      },
      onMove({ x, y, event: moveEvent }) {
        moveEvent.preventDefault()
        lastPoint = { x, y }
        preview?.move(x, y)
        scroller.update(x, y)
        track(x, y)
      },
      onEnd(endEvent, canceled) {
        stopDrag = undefined

        if (!active) return
        active = false
        stopScroll?.()
        stopScroll = undefined
        releaseCursor?.()
        releaseCursor = undefined
        hideAllHints()

        const outside = isOutsideBounds(listEls, options().bounds?.(), lastPoint.x, lastPoint.y)
        const externalDrop = options().outsideConsumed?.() ?? false
        const isOwnSlot = targetList === from && targetGap === fromIndex
        const shouldCommit =
          !canceled && !outside && !externalDrop && targetList !== null && !isOwnSlot
        const siblingEntries: FlipEntry[] = []

        for (const [itemKey, el] of itemEls) {
          if (itemKey === key || !el.isConnected) continue
          siblingEntries.push({ el, before: el.getBoundingClientRect() })
        }

        const activePreview = preview

        preview = undefined
        const settle = (destList: string | null, isExternalDrop = false) =>
          settleTransfer({
            store: context.store,
            key,
            destList,
            externalDrop: isExternalDrop,
            reduced,
            preview: activePreview,
            siblingEntries,
            itemEls,
            listEls,
            destroyHints,
            setCancelSettle: (cleanup) => {
              cancelSettle = cleanup
            },
          })

        if (externalDrop) {
          settle(null, true)
          return
        }

        if (shouldCommit && targetList !== null) {
          const index = targetGap ?? 0
          const nextLists = transferred(context.store.get().value, key, targetList, index)
          const accepted = change("value", nextLists, {
            reason: "drag",
            event: endEvent,
            key,
            from: from!,
            to: targetList,
            index,
          })

          if (accepted) {
            say("drop", key, nextLists, targetList)
            settle(targetList)
            return
          }

          say("cancel", key, context.store.get().value, from)
          settle(null)
          return
        }

        say(
          canceled || outside || targetList === null ? "cancel" : "drop",
          key,
          context.store.get().value,
          from,
        )
        settle(null)
      },
    })
  }

  let lastMoving: TransferDraft | null = null
  const unsubscribe = context.store.subscribe(() => {
    const next = context.store.get().moving

    if (next === lastMoving) return
    lastMoving = next
    options().onMovingChange?.(lastMoving)
  })

  context.onDestroy(() => {
    unsubscribe()
    stopDrag?.()
    stopScroll?.()
    releaseCursor?.()
    cancelPendingSettle()
    clearItemStyles(itemEls.values())
  })

  return {
    isDisabled: (key: string) => Boolean(options().disabled?.(key)),
    bindList(el: HTMLElement, list: string) {
      listEls.set(list, el)
      return () => {
        if (listEls.get(list) === el) listEls.delete(list)
      }
    },
    bindItem(el: HTMLElement, key: string) {
      itemEls.set(key, el)
      return () => {
        if (itemEls.get(key) === el) itemEls.delete(key)
      }
    },
    pointerdown,
    move(key: string, list: string, index: number) {
      const current = context.store.get().value
      const from = listWith(current, key)

      if (
        from === undefined ||
        (from !== list && options().accepts && !options().accepts!(key, from, list))
      )
        return false

      const next = transferred(current, key, list, index)

      if (sameLists(next, current)) return false

      if (!change("value", next, { reason: "imperative", key, from, to: list, index })) return false
      say("drop", key, next, list)
      return true
    },
  }
}
