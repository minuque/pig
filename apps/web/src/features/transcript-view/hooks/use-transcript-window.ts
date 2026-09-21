import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
  type Ref,
  toValue,
} from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  buildWindowBlocks,
  estimateRowHeight,
  mergeMountedIndices,
  resolveVisibleRange,
  TranscriptHeightIndex,
  WINDOW_DEFAULT_OVERSCAN,
  type TranscriptWindowBlock,
} from "@features/transcript-view/lib/transcript-window.js"
import { useTranscriptKeepAlive } from "@features/transcript-view/hooks/use-transcript-keep-alive.js"

export type TranscriptAnchor = { id: string; offset: number }

const ANCHOR_SLOT_MAX = 5
const TEMP_PIN_MS = 2500
const REVEAL_FRAMES = 3

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/**
 * 会话时间线窗口化：只挂视口附近的行 + 尾部常驻行，卸载行的 markstream 状态另有会话级缓存。
 * 实测高度以视口顶部项为锚回写，估算只在没有实测值时生效。
 */
export function useTranscriptWindow(options: {
  rows: Ref<readonly TimelineRow[]>
  scrollRoot: MaybeRefOrGetter<HTMLElement | null>
  listRoot: MaybeRefOrGetter<HTMLElement | null>
  isFollowing: () => boolean
  estimate?: (row: TimelineRow) => number
  overscan?: number
}) {
  const index = new TranscriptHeightIndex()
  const measured = new Map<string, number>()
  const tempPins = new Map<string, number>()
  const pendingHeights = new Map<string, number>()
  const observed = new Map<string, Element>()
  const idToIndex = new Map<string, number>()
  const version = shallowRef(0)
  const scrollTop = shallowRef(0)
  const viewportHeight = shallowRef(0)
  const anchors = new Map<string, TranscriptAnchor>()
  const { keepAlive } = useTranscriptKeepAlive(() => toValue(options.scrollRoot))
  let rootObserver: ResizeObserver | undefined
  let rowObserver: ResizeObserver | undefined
  let boundRoot: HTMLElement | null = null
  let pendingAnchor: TranscriptAnchor | null = null
  let anchorSettled = false
  let measureRaf = 0

  function indexOfId(id: string): number {
    return idToIndex.get(id) ?? -1
  }

  function estimateOf(row: TimelineRow): number {
    return Math.max(1, options.estimate ? options.estimate(row) : estimateRowHeight(row))
  }

  /** rows 变了就按实测缓存重建索引，新行先用估算值。 */
  function rebuild() {
    const rows = options.rows.value
    const sizes: number[] = []
    const flags: boolean[] = []

    idToIndex.clear()

    for (const [position, row] of rows.entries()) {
      const hit = measured.get(row.id)

      idToIndex.set(row.id, position)
      sizes.push(hit ?? estimateOf(row))
      flags.push(hit !== undefined)
    }

    index.reset(sizes, flags)
    version.value += 1
  }

  /** 常驻行：尾部一行、流式行、选区/焦点行、临时锚点行。 */
  function pinnedIndices(): number[] {
    const rows = options.rows.value
    const pinned: number[] = []
    const now = performance.now()

    if (rows.length > 0) pinned.push(rows.length - 1)

    for (const [id, expireAt] of tempPins) {
      if (expireAt < now) {
        tempPins.delete(id)
        continue
      }

      const at = idToIndex.get(id)

      if (at !== undefined) pinned.push(at)
    }

    for (const id of keepAlive.value) {
      const at = idToIndex.get(id)

      if (at !== undefined) pinned.push(at)
    }

    for (const [position, row] of rows.entries()) {
      if (row.role === "assistant" && row.streaming) pinned.push(position)
    }

    return pinned
  }

  const totalHeight = computed(() => {
    void version.value
    return index.total
  })
  const blocks = computed<TranscriptWindowBlock[]>(() => {
    void version.value
    const rows = options.rows.value

    if (rows.length === 0) return []
    const pinned = pinnedIndices()
    const height = viewportHeight.value
    const range =
      height > 0
        ? resolveVisibleRange({
            length: rows.length,
            scrollTop: scrollTop.value,
            viewportHeight: height,
            overscan: options.overscan ?? WINDOW_DEFAULT_OVERSCAN,
            at: (offset) => index.at(offset),
          })
        : { start: rows.length, end: -1 } // 首帧几何没量出来时只挂常驻行，贴底不用等估算
    return buildWindowBlocks(
      rows,
      mergeMountedIndices(range, pinned, rows.length),
      (at) => index.top(at),
      index.total,
    )
  })

  function writeScrollTop(root: HTMLElement, top: number) {
    root.scrollTop = top
    scrollTop.value = root.scrollTop
  }

  function heightOf(entry: ResizeObserverEntry): number {
    const box = entry.borderBoxSize?.[0]

    if (box) return box.blockSize
    return (entry.target as HTMLElement).getBoundingClientRect().height
  }

  /** 实测高度走 rAF 合批，避免逐行触发布局补偿。 */
  function onRowResize(entries: ResizeObserverEntry[]) {
    for (const entry of entries) {
      const id = (entry.target as HTMLElement).dataset.rowId

      if (!id) continue
      pendingHeights.set(id, heightOf(entry))
    }

    if (pendingHeights.size === 0 || measureRaf) return
    measureRaf = requestAnimationFrame(flushMeasurements)
  }

  function flushMeasurements() {
    measureRaf = 0
    const root = toValue(options.scrollRoot)
    const rows = options.rows.value
    const anchorRow = root ? rows[index.at(root.scrollTop)] : undefined
    const anchor = anchorRow ? idToIndex.get(anchorRow.id) : undefined
    const before = anchor === undefined ? 0 : index.top(anchor)
    let changed = false

    for (const [id, height] of pendingHeights) {
      const at = idToIndex.get(id)

      if (at === undefined) continue

      if (!index.apply(at, height, true)) continue
      measured.set(id, height)
      changed = true
    }

    pendingHeights.clear()

    if (!changed) return
    version.value += 1

    if (!root || anchor === undefined || options.isFollowing()) return
    // 只补锚点上方的高度差，下方的变化不影响视口起点
    const delta = index.top(anchor) - before

    if (delta !== 0) writeScrollTop(root, root.scrollTop + delta)
  }

  function syncObserved() {
    const root = toValue(options.scrollRoot)

    if (!root || !rowObserver) return
    const seen = new Set<string>()

    for (const el of root.querySelectorAll<HTMLElement>("[data-row-id]")) {
      const id = el.dataset.rowId

      if (!id) continue
      seen.add(id)

      if (observed.has(id)) continue
      observed.set(id, el)
      rowObserver.observe(el)
    }

    for (const [id, el] of observed) {
      if (seen.has(id)) continue
      rowObserver.unobserve(el)
      observed.delete(id)
    }
  }

  function findRow(id: string): HTMLElement | null {
    const root = toValue(options.scrollRoot)

    if (!root) return null
    return root.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)
  }

  /** 强制挂载某行一小段时间，用于选区恢复和跳转。 */
  function pinRow(id: string, ttlMs = TEMP_PIN_MS) {
    tempPins.set(id, performance.now() + ttlMs)
    version.value += 1
  }

  /** 让某行进入窗口并返回它的元素。 */
  async function revealRow(id: string): Promise<HTMLElement | null> {
    pinRow(id)

    for (let attempt = 0; attempt < REVEAL_FRAMES; attempt += 1) {
      await nextTick()
      const el = findRow(id)

      if (el) return el
      await nextFrame()
    }

    return findRow(id)
  }

  /** 按高度表把某行放到视口指定偏移处，行没挂载也算得准。 */
  function scrollToRow(id: string, offsetPx = 0) {
    const root = toValue(options.scrollRoot)
    const list = toValue(options.listRoot)
    const at = idToIndex.get(id)

    if (!root || !list || at === undefined) return

    const base =
      list.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop
    const top = Math.max(0, base + index.top(at) - offsetPx)

    pinRow(id)
    writeScrollTop(root, top)
  }

  /** 第一个可见行及其视口相对偏移，切会话用它复位。 */
  /** 第一个可见行及其视口相对偏移，切会话用它复位。 */
  function captureAnchor(): TranscriptAnchor | null {
    const root = toValue(options.scrollRoot)

    if (!root) return null
    const rootTop = root.getBoundingClientRect().top

    for (const el of root.querySelectorAll<HTMLElement>("[data-row-id]")) {
      const id = el.dataset.rowId
      const rect = el.getBoundingClientRect()

      if (!id || rect.bottom <= rootTop) continue
      return { id, offset: rect.top - rootTop }
    }

    return null
  }

  /** 记住某会话当前视口位置，最近 5 个会话各留一份。 */
  function rememberAnchor(scope: string) {
    if (!scope) return
    const anchor = captureAnchor()

    if (!anchor) return
    anchors.delete(scope)
    anchors.set(scope, anchor)

    while (anchors.size > ANCHOR_SLOT_MAX) {
      const oldest = anchors.keys().next().value

      if (oldest === undefined || oldest === scope) break
      anchors.delete(oldest)
    }
  }

  /** 切会话时取出锚点待恢复；返回是否有锚点。 */
  function takeAnchor(scope: string): boolean {
    pendingAnchor = anchors.get(scope) ?? null
    anchorSettled = false
    return pendingAnchor !== null
  }

  function hasPendingAnchor(): boolean {
    return pendingAnchor !== null
  }

  /** 按锚点反推 scrollTop；返回本次是否已经处理过（重复调用不会重复复位）。 */
  function applyAnchor(): boolean {
    const anchor = pendingAnchor

    if (!anchor) return anchorSettled
    pendingAnchor = null

    if (indexOfId(anchor.id) < 0) return false
    scrollToRow(anchor.id, anchor.offset)
    anchorSettled = true
    return true
  }

  /** 前缀插入等外部改动 scrollTop 后同步窗口位置。 */
  function windowShift(deltaPx: number) {
    if (!deltaPx) return
    scrollTop.value = Math.max(0, scrollTop.value + deltaPx)
  }

  function bindRoot(el: HTMLElement | null) {
    rootObserver?.disconnect()
    rootObserver = undefined
    rowObserver?.disconnect()
    rowObserver = undefined
    observed.clear()

    if (boundRoot) boundRoot.removeEventListener("scroll", onScroll)
    boundRoot = el
    viewportHeight.value = 0

    if (!el) return
    el.addEventListener("scroll", onScroll, { passive: true })
    rootObserver = new ResizeObserver(() => {
      viewportHeight.value = el.clientHeight
    })
    rootObserver.observe(el)
    rowObserver = new ResizeObserver(onRowResize)
    void nextTick(syncObserved)
  }

  function onScroll() {
    const root = toValue(options.scrollRoot)

    if (!root) return
    scrollTop.value = root.scrollTop
  }

  function reset() {
    measured.clear()
    tempPins.clear()
    pendingHeights.clear()
    const root = toValue(options.scrollRoot)

    scrollTop.value = root ? root.scrollTop : 0
    rebuild()
  }

  watch(
    [() => toValue(options.listRoot), () => toValue(options.scrollRoot)],
    ([, root]) => bindRoot(root),
    { flush: "post", immediate: true },
  )

  watch(blocks, () => void nextTick(syncObserved), { flush: "post" })
  watch(options.rows, rebuild, { flush: "sync", immediate: true })

  onBeforeUnmount(() => {
    rootObserver?.disconnect()
    rowObserver?.disconnect()
    rootObserver = undefined
    rowObserver = undefined

    if (measureRaf) cancelAnimationFrame(measureRaf)
  })
  return {
    blocks,
    totalHeight,
    revealRow,
    scrollToRow,
    rememberAnchor,
    takeAnchor,
    hasPendingAnchor,
    applyAnchor,
    windowShift,
    reset,
  }
}
