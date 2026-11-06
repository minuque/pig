import { moveSessionId } from "@features/session-nav/lib/session-list.js"
import type { SidebarSectionKind } from "@features/session-nav/type.js"

/** 拖拽落点：置顶区、收件箱、已归档；工作中不收行。 */
export type DropZone = "pinned" | "active" | "settled"

export type DropVerb = "pin" | "unpin" | "settle" | "unsettle"

export type DropPlan =
  | { kind: "none" }
  | { kind: "reorder-pinned"; slot: number }
  | { kind: "pin"; slot: number }
  | { kind: "unpin" }
  | { kind: "settle" }
  | { kind: "unsettle" }

/** 落点上的动作提示：同段内换位不提示。 */
export function dropVerb(from: SidebarSectionKind, zone: DropZone | null): DropVerb | null {
  if (zone === null || zone === from) return null

  if (zone === "pinned") return "pin"

  if (zone === "settled") return "settle"

  if (from === "pinned") return "unpin"
  return from === "settled" ? "unsettle" : null
}

/** 松手要做的事；slot 按移动前的置顶全表计，与 moveSessionId 同义。 */
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

/** 可见置顶行里的第 k 个空位换算成全表 slot：筛选态下可见行只是全表子集。 */
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

/** 一行投影里的条目：会话行、拖拽时才撑开的段名，或空段的占位。 */
export interface LayoutItem {
  key: string
  kind: "row" | "label" | "slot"
}

/**
 * 拖拽预演：被拖行从原处抽走，在 insertAfter 之后空出一格，段名撑开 label 高。
 * 返回每项相对静止布局的纵向位移。
 */
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

/** 按住行尾动作扫过的会话：起点到当前行之间，只留能做这个动作的。 */
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

/** 按时间排的段里，被拖行该落在第几个：排序键大的在前，同分按 id。 */
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
