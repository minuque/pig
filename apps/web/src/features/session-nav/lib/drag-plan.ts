import { moveSessionId } from "@features/session-nav/lib/session-list.js"
import type { SidebarSectionKind } from "@features/session-nav/type.js"

export type DropZone = "pinned" | "active" | "settled"

export type DropVerb = "pin" | "unpin" | "settle" | "unsettle"

export type DropPlan =
  | { kind: "none" }
  | { kind: "reorder-pinned"; slot: number }
  | { kind: "pin"; slot: number }
  | { kind: "unpin" }
  | { kind: "settle" }
  | { kind: "unsettle" }

export function dropVerb(from: SidebarSectionKind, zone: DropZone | null): DropVerb | null {
  if (zone === null || zone === from) return null

  if (zone === "pinned") return "pin"

  if (zone === "settled") return "settle"

  if (from === "pinned") return "unpin"
  return from === "settled" ? "unsettle" : null
}

export function planDrop(input: {
  id: string
  from: SidebarSectionKind
  zone: DropZone | null
  pinnedOrder: readonly string[]
  slot: number
}): DropPlan {
  const { id, from, zone } = input

  if (from === "working" || zone === null) return { kind: "none" }

  if (zone === "pinned") {
    if (from !== "pinned") return { kind: "pin", slot: input.slot }
    const next = moveSessionId(input.pinnedOrder, id, input.slot)
    const same = next.every((item, index) => item === input.pinnedOrder[index])
    return same ? { kind: "none" } : { kind: "reorder-pinned", slot: input.slot }
  }

  if (zone === "settled") return from === "settled" ? { kind: "none" } : { kind: "settle" }

  if (from === "pinned") return { kind: "unpin" }
  return from === "settled" ? { kind: "unsettle" } : { kind: "none" }
}

export function pinnedSlot(
  order: readonly string[],
  visible: readonly string[],
  index: number,
): number {
  const before = visible[index]

  if (before !== undefined) return Math.max(0, order.indexOf(before))
  const last = visible.at(-1)
  return last === undefined ? 0 : order.indexOf(last) + 1
}

export interface LayoutItem {
  key: string
  kind: "row" | "label" | "slot"
}

export function projectOffsets(input: {
  items: readonly LayoutItem[]
  activeKey?: string | undefined
  insertAfter?: string | undefined
  size: number
  label: number
}): Map<string, number> {
  const offsets = new Map<string, number>()
  let offset = 0

  for (const item of input.items) {
    if (item.key === input.activeKey) {
      offset -= input.size
      continue
    }

    offsets.set(item.key, offset)

    if (item.kind === "label") offset += input.label

    if (item.key === input.insertAfter) offset += input.size
  }

  return offsets
}

export function sweepIds(
  order: readonly string[],
  origin: string,
  target: string,
  canApply: (id: string) => boolean,
): string[] {
  const from = order.indexOf(origin)
  const to = order.indexOf(target)

  if (from === -1 || to === -1) return []
  return order.slice(Math.min(from, to), Math.max(from, to) + 1).filter(canApply)
}

export function sortedSlot(
  rows: readonly { id: string; sortKey: number }[],
  active: { id: string; sortKey: number },
): number {
  const at = rows.findIndex(
    (row) =>
      row.sortKey < active.sortKey ||
      (row.sortKey === active.sortKey && row.id.localeCompare(active.id) > 0),
  )
  return at === -1 ? rows.length : at
}
