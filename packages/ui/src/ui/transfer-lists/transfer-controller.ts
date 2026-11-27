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
  acquireGlobalDragging,
  clearItemStyles,
  createLiftedPreview,
  prefersReducedMotion,
  runFlipSettle,
  type FlipEntry,
  type LiftedPreviewHandle,
} from "../../core/drag-stage.js"
import {
  dropIndex,
  isOutsideBounds,
  layoutMidY,
  listAt,
  listWith,
  sameLists,
  settleTransfer,
  transferred,
  type TransferChange,
  type TransferChangeDetails,
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
  let stopDrag: (() => void) | undefined
  let stopScroll: (() => void) | undefined
  let releaseCursor: (() => void) | undefined
  let preview: LiftedPreviewHandle | undefined
  let cancelSettle: (() => void) | undefined
  let stopLiveFlip: (() => void) | undefined
  let flipSeq = 0

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

  function cancelPendingSettle() {
    flipSeq += 1
    stopLiveFlip?.()
    stopLiveFlip = undefined
    cancelSettle?.()
    cancelSettle = undefined
    preview?.destroy()
    preview = undefined
    clearItemStyles(itemEls.values())

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
    let reduced = false
    let originLists = context.store.get().value
    let lastPoint = { ...downPoint }

    function applyDraft(nextLists: TransferLists, nextTo: string | null) {
      const state = context.store.get()
      const current = state.moving

      if (!current) return

      const listsSame = sameLists(nextLists, current.lists)

      if (listsSame && state.to === nextTo) return

      if (listsSame || reduced) {
        context.store.set({
          moving: listsSame ? current : { ...current, lists: nextLists },
          to: nextTo,
        })
        return
      }

      const entries: FlipEntry[] = []

      for (const [itemKey, el] of itemEls) {
        if (itemKey === key || !el.isConnected) continue
        entries.push({ el, before: el.getBoundingClientRect() })
      }

      flipSeq += 1
      const seq = flipSeq

      context.store.set({
        moving: { ...current, lists: nextLists },
        to: nextTo,
      })

      void nextTick(() => {
        if (!active || seq !== flipSeq) return
        stopLiveFlip?.()
        stopLiveFlip = runFlipSettle(entries, false)
      })
    }

    function track(x: number, y: number) {
      if (!active) return

      const current = context.store.get().moving

      if (!current) return

      if (isOutsideBounds(listEls, options().bounds?.(), x, y)) {
        applyDraft(originLists, null)
        return
      }

      const hit = listAt(listEls, x, y)
      const accepted = Boolean(hit && (options().accepts?.(key, from!, hit) ?? true))

      if (!accepted || !hit) {
        applyDraft(originLists, null)
        return
      }

      const canReorder = options().reorderable?.(hit, key) ?? true
      let index = 0

      if (canReorder) {
        const others = (current.lists[hit] ?? []).filter((itemKey) => itemKey !== key)
        const middles = others.map((itemKey) => {
          const itemEl = itemEls.get(itemKey)
          return itemEl && itemEl.isConnected ? layoutMidY(itemEl) : 0
        })

        index = dropIndex(middles, y)
      }

      const nextLists = transferred(current.lists, key, hit, index)
      const changed = !sameLists(nextLists, current.lists)

      applyDraft(nextLists, hit)

      if (changed) say("move", key, nextLists, hit)
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

        originLists = currentLists
        reduced = prefersReducedMotion()
        active = true

        if (!reduced) {
          preview = createLiftedPreview(startEl, {
            start: downPoint,
            orientation: "vertical",
            liftSide: "end",
            lift: "inline",
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

        const state = context.store.get()
        const outside = isOutsideBounds(listEls, options().bounds?.(), lastPoint.x, lastPoint.y)
        const externalDrop = options().outsideConsumed?.() ?? false
        const draftLists = state.moving?.lists ?? originLists
        const destList = listWith(draftLists, key) ?? from!
        const destIndex = Math.max(0, (draftLists[destList] ?? []).indexOf(key))
        const moved = !sameLists(draftLists, originLists)
        const shouldCommit = !canceled && !outside && !externalDrop && moved
        const siblingEntries: FlipEntry[] = []

        for (const [itemKey, el] of itemEls) {
          if (itemKey === key || !el.isConnected) continue
          siblingEntries.push({ el, before: el.getBoundingClientRect() })
        }

        flipSeq += 1
        stopLiveFlip?.()
        stopLiveFlip = undefined

        const activePreview = preview

        preview = undefined
        const settle = (settleList: string | null, isExternalDrop = false) =>
          settleTransfer({
            store: context.store,
            key,
            destList: settleList,
            externalDrop: isExternalDrop,
            reduced,
            preview: activePreview,
            siblingEntries,
            itemEls,
            listEls,
            setCancelSettle: (cleanup) => {
              cancelSettle = cleanup
            },
          })

        if (externalDrop) {
          settle(null, true)
          return
        }

        if (shouldCommit) {
          const accepted = change("value", draftLists, {
            reason: "drag",
            event: endEvent,
            key,
            from: from!,
            to: destList,
            index: destIndex,
          })

          if (accepted) {
            say("drop", key, draftLists, destList)
            settle(destList)
            return
          }

          say("cancel", key, context.store.get().value, from)
          settle(null)
          return
        }

        say(
          canceled || outside || state.to === null ? "cancel" : "drop",
          key,
          context.store.get().value,
          from,
        )
        settle(state.to !== null && !canceled && !outside ? destList : null)
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
