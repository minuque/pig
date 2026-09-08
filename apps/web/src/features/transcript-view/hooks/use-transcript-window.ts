import { useVirtualList } from "@vueuse/core"
import { computed, nextTick, shallowRef, watch, type MaybeRefOrGetter, toValue } from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"

export type TranscriptWindowItem = {
  row: TimelineRow
  key: string
  height: number
}

const OVERSCAN = 8
const MIN_HEIGHT = 1

function gapAfter(row: TimelineRow, next: TimelineRow | undefined): number {
  if (!next) return 0
  if (next.role === "user") return 28
  if (row.role === "user") return 24
  return 16
}

function estimateBody(row: TimelineRow): number {
  if (row.role === "user") {
    const lines = Math.max(1, Math.ceil(row.text.length / 42))
    return 36 + Math.min(336, lines * 21)
  }
  if (row.role === "tools") return 40
  const lines = Math.max(1, Math.ceil(row.text.length / 56))
  return Math.min(2400, 28 + lines * 22)
}

function estimateRowHeight(row: TimelineRow, next: TimelineRow | undefined): number {
  return Math.max(MIN_HEIGHT, estimateBody(row) + gapAfter(row, next))
}

/** 只挂视口附近的行；历史一次到达时先滚到底部窗口。 */
export function useTranscriptWindow(
  rows: MaybeRefOrGetter<readonly TimelineRow[]>,
  keys: MaybeRefOrGetter<readonly string[]>,
) {
  const measured = shallowRef<number[]>([])
  let pendingLatest = false

  const windowItems = computed(() => {
    const list = toValue(rows)
    const rowKeys = toValue(keys)
    const sizes = measured.value
    return list.map((row, index) => ({
      row,
      key: rowKeys[index] ?? row.id,
      height: sizes[index] ?? estimateRowHeight(row, list[index + 1]),
    }))
  })

  const sourceList = shallowRef<TranscriptWindowItem[]>([])

  watch(
    windowItems,
    (items) => {
      sourceList.value = items
    },
    { flush: "sync", immediate: true },
  )

  const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(sourceList, {
    itemHeight: (index) => sourceList.value[index]?.height ?? MIN_HEIGHT,
    overscan: OVERSCAN,
  })

  function resetHeights() {
    measured.value = []
  }

  function measureVisible(root: HTMLElement | null): boolean {
    if (!root) return false
    const listRows = toValue(rows)
    const next = measured.value.slice()
    let changed = false
    for (const el of root.querySelectorAll<HTMLElement>("[data-row-index]")) {
      const index = Number(el.dataset.rowIndex)
      if (!Number.isInteger(index) || index < 0 || index >= listRows.length) continue
      const height = el.offsetHeight
      if (height > 0 && next[index] !== height) {
        next[index] = height
        changed = true
      }
    }
    if (changed) measured.value = next
    return changed
  }

  function stickToLatest() {
    const items = windowItems.value
    const last = items.length - 1
    if (last < 0) return
    const el = containerProps.ref.value
    if (el) {
      const total = items.reduce((sum, item) => sum + item.height, 0)
      el.scrollTop = Math.max(0, total - el.clientHeight)
    }
    scrollTo(last, { behavior: "auto", block: "end" })
  }

  async function revealRow(index: number): Promise<HTMLElement | null> {
    if (index < 0) return null
    scrollTo(index, { behavior: "auto", block: "start" })
    await nextTick()
    const root = containerProps.ref.value
    const found = root?.querySelector<HTMLElement>(`[data-row-index="${index}"]`)
    if (found) return found
    scrollTo(index, { behavior: "auto", block: "start" })
    await nextTick()
    return root?.querySelector<HTMLElement>(`[data-row-index="${index}"]`) ?? null
  }

  watch(
    () => toValue(rows).length,
    (len, prev) => {
      if (len === 0) {
        pendingLatest = false
        resetHeights()
        return
      }
      if ((prev ?? 0) === 0) {
        pendingLatest = true
        stickToLatest()
      }
    },
    { flush: "pre" },
  )

  watch(
    list,
    () => {
      if (!pendingLatest) return
      stickToLatest()
      const last = windowItems.value.length - 1
      if (last >= 0 && list.value.some((item) => item.index === last)) pendingLatest = false
    },
    { flush: "pre" },
  )

  return {
    list,
    containerProps,
    wrapperProps,
    measureVisible,
    stickToLatest,
    revealRow,
    resetHeights,
  }
}
