import type { TimelineRow } from "@features/transcript-view/type.js"

/** 未测量前的行高初值：用户句短、助手正文长、工具过程居中。 */
export function estimateRowHeight(role: TimelineRow["role"]): number {
  if (role === "user") return 88

  if (role === "assistant") return 240
  return 180
}

const HEIGHT_DEADZONE = 0.25
/** 视口外至少多挂这么高的内容，避免快速滚动时露白。 */
export const WINDOW_MIN_BUFFER = 400
export const WINDOW_DEFAULT_OVERSCAN = 1

/** 行高索引：reset O(n)，apply O(log n)，top 前缀和，at 偏移反查下标。 */
export class TranscriptHeightIndex {
  private tree = new Float64Array(1)
  private sizes = new Float64Array(0)
  private flags = new Uint8Array(0)
  private count = 0

  constructor(sizes: readonly number[] = [], measured: readonly boolean[] = []) {
    this.reset(sizes, measured)
  }

  get length(): number {
    return this.count
  }

  get total(): number {
    return this.top(this.count)
  }

  reset(sizes: readonly number[], measured: readonly boolean[] = []): void {
    this.count = sizes.length
    this.sizes = Float64Array.from(sizes)
    this.flags = Uint8Array.from({ length: this.count }, (_, index) => (measured[index] ? 1 : 0))
    const tree = new Float64Array(this.count + 1)

    for (let index = 0; index < this.count; index += 1) {
      const slot = index + 1
      const value = (tree[slot] ?? 0) + (this.sizes[index] ?? 0)

      tree[slot] = value
      const parent = slot + (slot & -slot)

      if (parent <= this.count) tree[parent] = (tree[parent] ?? 0) + value
    }

    this.tree = tree
  }

  size(index: number): number {
    return this.sizes[index] ?? 0
  }

  isMeasured(index: number): boolean {
    return this.flags[index] === 1
  }

  /** 前 index 行的高度和。 */
  top(index: number): number {
    let sum = 0
    let slot = Math.min(Math.max(Math.trunc(index), 0), this.count)

    while (slot > 0) {
      sum += this.tree[slot] ?? 0
      slot -= slot & -slot
    }

    return sum
  }

  /** 落在 offset 像素处的行下标；越界钳到两端。 */
  at(offset: number): number {
    if (this.count === 0) return -1

    if (!Number.isFinite(offset) || offset <= 0) return 0

    if (offset >= this.total) return this.count - 1
    let slot = 0
    let rest = offset
    let bit = 1

    while (bit * 2 <= this.count) bit *= 2

    for (; bit > 0; bit >>= 1) {
      const next = slot + bit

      if (next <= this.count && (this.tree[next] ?? 0) <= rest) {
        slot = next
        rest -= this.tree[next] ?? 0
      }
    }

    return Math.min(slot, this.count - 1)
  }

  /** 实测永久生效；估算只能覆盖还没有实测值的行。返回是否真的改了。 */
  apply(index: number, height: number, measured: boolean): boolean {
    if (index < 0 || index >= this.count) return false

    if (!measured && this.flags[index] === 1) return false
    const next = Math.max(0, height)
    const delta = next - (this.sizes[index] ?? 0)

    if (delta === 0) return false

    if (measured && Math.abs(delta) < HEIGHT_DEADZONE) return false
    this.sizes[index] = next

    if (measured) this.flags[index] = 1
    let slot = index + 1

    while (slot <= this.count) {
      this.tree[slot] = (this.tree[slot] ?? 0) + delta
      slot += slot & -slot
    }

    return true
  }
}

/** 视口偏移投影出要挂载的行区间。 */
export function resolveVisibleRange(input: {
  length: number
  scrollTop: number
  viewportHeight: number
  overscan?: number
  at: (offset: number) => number
}): { start: number; end: number } {
  const { length } = input

  if (length <= 0) return { start: 0, end: -1 }
  const overscan = input.overscan ?? WINDOW_DEFAULT_OVERSCAN
  const buffer = Math.max(WINDOW_MIN_BUFFER, Math.max(0, input.viewportHeight) * overscan)
  const start = Math.max(0, Math.min(input.at(Math.max(0, input.scrollTop - buffer)), length - 1))
  const end = Math.max(
    start,
    Math.min(input.at(Math.max(0, input.scrollTop) + input.viewportHeight + buffer), length - 1),
  )
  return { start, end }
}

/** 视口范围并入常驻行（尾部、流式、选区），去重升序，常驻行走独立 space 空档。 */
export function mergeMountedIndices(
  range: { start: number; end: number },
  pinned: readonly number[],
  length: number,
): number[] {
  const mounted = new Set<number>()

  for (let at = range.start; at <= range.end; at += 1) {
    if (at >= 0 && at < length) mounted.add(at)
  }

  for (const at of pinned) {
    if (at >= 0 && at < length) mounted.add(at)
  }

  return [...mounted].sort((left, right) => left - right)
}

export type TranscriptWindowBlock =
  | { kind: "space"; key: string; height: number }
  | { kind: "row"; key: string; row: TimelineRow; index: number }

/** 要挂载的下标列表 → 块序列：空档用 space 补，首尾也补。 */
export function buildWindowBlocks(
  rows: readonly TimelineRow[],
  mounted: readonly number[],
  topOf: (index: number) => number,
  total: number,
): TranscriptWindowBlock[] {
  if (rows.length === 0 || mounted.length === 0) return []
  const blocks: TranscriptWindowBlock[] = []
  let cursor = 0

  for (const index of mounted) {
    const row = rows[index]

    if (!row) continue

    if (index > cursor) {
      const height = topOf(index) - topOf(cursor)

      if (height > 0) {
        blocks.push({ kind: "space", key: cursor === 0 ? "space:head" : `space:${cursor}`, height })
      }
    }

    blocks.push({ kind: "row", key: row.id, row, index })
    cursor = index + 1
  }

  const tail = total - topOf(cursor)

  if (tail > 0) blocks.push({ kind: "space", key: "space:tail", height: tail })
  return blocks
}
