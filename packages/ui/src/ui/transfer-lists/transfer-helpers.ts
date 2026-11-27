import { nextTick } from "vue"
import type {
  ChangeDetails,
  PrimitiveContext,
  TransferDraft,
  TransferLists,
  TransferMessage,
  TransferReason,
} from "@ui-sdk/core"
import { isPointOutsideRect, OUTSIDE_SLOP_PX } from "../../core/drag-physics.js"
import {
  clearItemStyles,
  runFlipSettle,
  type FlipEntry,
  type LiftedPreviewHandle,
} from "../../core/drag-stage.js"

export type TransferChangeDetails = ChangeDetails<TransferReason> & {
  key: string
  from: string
  to: string
  index: number
}

export type TransferListsOptions = {
  value?: TransferLists
  defaultValue?: TransferLists
  onValueChange?: (value: TransferLists, details: TransferChangeDetails) => void
  onMovingChange?: (moving: TransferDraft | null) => void
  order?: () => string[]
  disabled?: (key: string) => boolean
  reorderable?: (list: string, key: string) => boolean
  accepts?: (key: string, from: string, to: string) => boolean
  bounds?: () => HTMLElement | undefined
  outsideConsumed?: () => boolean
  itemLabel?: (key: string) => string | undefined
  listLabel?: (list: string) => string | undefined
  message?: (message: TransferMessage) => string
}

export type TransferState = {
  value: TransferLists
  moving: TransferDraft | null
  to: string | null
  settling: string | null
  reduced: boolean
}

export type TransferChange = (
  key: "value",
  value: TransferLists,
  details: {
    reason: TransferReason
    event?: Event | undefined
    key: string
    from: string
    to: string
    index: number
  },
) => boolean

export type TransferSettleParams = {
  store: PrimitiveContext<TransferListsOptions, TransferState, "root" | "list" | "item">["store"]
  key: string
  destList: string | null
  externalDrop: boolean
  reduced: boolean
  preview: LiftedPreviewHandle | undefined
  siblingEntries: readonly FlipEntry[]
  itemEls: ReadonlyMap<string, HTMLElement>
  listEls: ReadonlyMap<string, HTMLElement>
  setCancelSettle: (cleanup: (() => void) | undefined) => void
}

export function listWith(lists: TransferLists, key: string): string | undefined {
  return Object.keys(lists).find((list) => lists[list]?.includes(key))
}

export function transferred(
  lists: TransferLists,
  key: string,
  list: string,
  index: number,
): TransferLists {
  const next: TransferLists = {}

  for (const [name, keys] of Object.entries(lists)) {
    next[name] = keys.filter((item) => item !== key)
  }

  const target = [...(next[list] ?? [])]

  target.splice(Math.max(0, Math.min(target.length, index)), 0, key)
  next[list] = target
  return next
}

export function sameLists(a: TransferLists, b: TransferLists): boolean {
  const keys = Object.keys(a)
  return (
    keys.length === Object.keys(b).length &&
    keys.every(
      (list) =>
        a[list]?.length === b[list]?.length && a[list]!.every((key, i) => b[list]![i] === key),
    )
  )
}

export function listAt(
  listEls: ReadonlyMap<string, HTMLElement>,
  x: number,
  y: number,
): string | undefined {
  let best: { list: string; distance: number } | undefined

  for (const [list, el] of listEls) {
    if (!el.isConnected) continue
    const rect = el.getBoundingClientRect()
    const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0
    const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0
    const distance = Math.hypot(dx, dy)

    if (!best || distance < best.distance) best = { list, distance }
  }

  return best?.list
}

export function isOutsideBounds(
  listEls: ReadonlyMap<string, HTMLElement>,
  boundsEl: HTMLElement | undefined,
  x: number,
  y: number,
): boolean {
  if (boundsEl) {
    return isPointOutsideRect({ x, y }, boundsEl.getBoundingClientRect(), 0, OUTSIDE_SLOP_PX)
  }

  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity

  for (const el of listEls.values()) {
    if (!el.isConnected) continue
    const rect = el.getBoundingClientRect()

    if (rect.left < left) left = rect.left

    if (rect.top < top) top = rect.top

    if (rect.right > right) right = rect.right

    if (rect.bottom > bottom) bottom = rect.bottom
  }

  if (left === Infinity) return false
  return isPointOutsideRect({ x, y }, { left, top, right, bottom }, OUTSIDE_SLOP_PX)
}

export function layoutMidY(el: HTMLElement): number {
  const rect = el.getBoundingClientRect()
  const view = el.ownerDocument.defaultView ?? window
  const transform = view.getComputedStyle(el).transform
  let translateY = 0

  if (transform && transform !== "none") {
    const Matrix = view.DOMMatrixReadOnly ?? globalThis.DOMMatrixReadOnly

    if (Matrix) {
      try {
        translateY = new Matrix(transform).m42
      } catch {
        translateY = 0
      }
    }
  }

  return rect.top - translateY + rect.height / 2
}

export function dropIndex(middles: readonly number[], y: number): number {
  let index = 0

  for (const mid of middles) {
    if (mid < y) index += 1
  }

  return index
}

export function settleTransfer({
  store,
  key,
  destList,
  externalDrop,
  reduced,
  preview,
  siblingEntries,
  itemEls,
  listEls,
  setCancelSettle,
}: TransferSettleParams): void {
  if (externalDrop) {
    let cancelled = false
    let stopFlip: (() => void) | undefined

    setCancelSettle(() => {
      cancelled = true
      stopFlip?.()
    })
    preview?.destroy()
    store.set({ moving: null, to: null, settling: null })
    void nextTick(() => {
      if (cancelled) return
      stopFlip = runFlipSettle(siblingEntries, reduced, () => {
        if (!cancelled) setCancelSettle(undefined)
      })
    })
    return
  }

  if (reduced || !preview) {
    preview?.destroy()
    clearItemStyles(itemEls.values())
    store.set({ moving: null, to: null, settling: null })
    return
  }

  let cancelled = false
  let stopFlip: (() => void) | undefined

  setCancelSettle(() => {
    cancelled = true
    stopFlip?.()
    preview.destroy()
  })

  const fallbackEl = destList
    ? (listEls.get(destList)?.querySelector<HTMLElement>("[data-drop-hint-box]") ??
      listEls.get(destList))
    : null
  const fallbackRect = fallbackEl?.getBoundingClientRect() ?? null

  const finishSettle = () => {
    if (cancelled) return
    if (store.get().settling === key) store.set({ settling: null })
    setCancelSettle(undefined)
  }

  store.set({ moving: null, to: null, settling: key })
  void nextTick(() => {
    if (cancelled) return
    stopFlip = runFlipSettle(siblingEntries, false)
    const landed = itemEls.get(key)
    const landedRect = landed && landed.isConnected ? landed.getBoundingClientRect() : null

    if (landedRect && landedRect.height > 0) {
      preview.settleTo(landedRect, { onDone: finishSettle })
      return
    }

    preview.settleTo(fallbackRect, { fadeOut: Boolean(fallbackRect), onDone: finishSettle })
  })
}
