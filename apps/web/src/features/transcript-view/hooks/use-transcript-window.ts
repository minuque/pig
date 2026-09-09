import {
  computed,
  nextTick,
  onBeforeUnmount,
  shallowRef,
  watch,
  type MaybeRefOrGetter,
  toValue,
} from "vue"
import type { TimelineRow } from "@features/transcript-view/type.js"
import {
  extendWindowToTail,
  lastTurnStartIndex,
  resolveTranscriptWindow,
  TRANSCRIPT_ROW_FALLBACK_HEIGHT,
  TRANSCRIPT_WINDOW_OVERSCAN,
} from "@features/transcript-view/lib/transcript-window.js"

const BACKFILL_PER_FRAME = 8

export function useTranscriptWindow(options: {
  rows: MaybeRefOrGetter<readonly TimelineRow[]>
  keys: MaybeRefOrGetter<readonly string[]>
  running: MaybeRefOrGetter<boolean>
  atBottom: MaybeRefOrGetter<boolean>
  viewport: MaybeRefOrGetter<HTMLElement | null>
  pinIfNeeded: () => void
}) {
  const windowStart = shallowRef(lastTurnStartIndex(toValue(options.rows)))
  const sliceStart = shallowRef(windowStart.value)
  const sliceEnd = shallowRef(toValue(options.rows).length)
  const padTop = shallowRef(0)
  const padBottom = shallowRef(0)
  const liveEnter = shallowRef(false)

  const boxByKey = new Map<string, number>()
  const observed = new Map<string, HTMLElement>()
  const rowObserver = new ResizeObserver((entries) => {
    let changed = false
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const key = el.dataset.rowKey
      if (!key) continue
      const size = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      if (boxByKey.get(key) === size) continue
      boxByKey.set(key, size)
      changed = true
    }
    if (changed) applyViewportWindow()
  })

  let backfillRaf = 0
  let backfillGen = 0
  let windowRaf = 0

  const mountedFrom = computed(() => (windowStart.value > 0 ? windowStart.value : sliceStart.value))

  const mountedRows = computed(() => {
    const rows = toValue(options.rows)
    if (windowStart.value > 0) return rows.slice(windowStart.value)
    return rows.slice(sliceStart.value, sliceEnd.value)
  })

  const mountedKeys = computed(() => {
    const keys = toValue(options.keys)
    if (windowStart.value > 0) return keys.slice(windowStart.value)
    return keys.slice(sliceStart.value, sliceEnd.value)
  })

  const windowed = computed(
    () => windowStart.value <= 0 && (padTop.value > 0 || padBottom.value > 0),
  )

  function currentHeights(): number[] {
    const keys = toValue(options.keys)
    return keys.map((key) => boxByKey.get(key) ?? 0)
  }

  function applySlice(start: number, end: number, top: number, bottom: number) {
    if (
      sliceStart.value === start &&
      sliceEnd.value === end &&
      padTop.value === top &&
      padBottom.value === bottom
    ) {
      return
    }
    sliceStart.value = start
    sliceEnd.value = end
    padTop.value = top
    padBottom.value = bottom
  }

  function applyViewportWindow() {
    const rows = toValue(options.rows)
    const count = rows.length
    if (windowStart.value > 0) {
      applySlice(windowStart.value, count, 0, 0)
      return
    }
    const root = toValue(options.viewport)
    if (!root || count === 0) {
      applySlice(0, count, 0, 0)
      return
    }
    let next = resolveTranscriptWindow(
      currentHeights(),
      root.scrollTop,
      root.clientHeight,
      TRANSCRIPT_WINDOW_OVERSCAN,
    )
    if (toValue(options.atBottom) || toValue(options.running)) {
      next = extendWindowToTail(next, count)
    }
    applySlice(next.start, next.end, next.padTop, next.padBottom)
  }

  function scheduleWindow() {
    if (windowRaf) return
    windowRaf = requestAnimationFrame(() => {
      windowRaf = 0
      applyViewportWindow()
    })
  }

  function bindRow(el: unknown, key: string) {
    const prev = observed.get(key)
    if (prev && prev !== el) {
      rowObserver.unobserve(prev)
      observed.delete(key)
    }
    if (!(el instanceof HTMLElement)) return
    el.dataset.rowKey = key
    observed.set(key, el)
    rowObserver.observe(el)
  }

  function rowOffset(index: number): number {
    const heights = currentHeights()
    let top = 0
    const limit = Math.max(0, Math.min(index, heights.length))
    for (let i = 0; i < limit; i += 1) {
      const height = heights[i] ?? 0
      top += height > 0 ? height : TRANSCRIPT_ROW_FALLBACK_HEIGHT
    }
    return top
  }

  function enableLiveEnter() {
    if (liveEnter.value) return
    void nextTick(() => {
      liveEnter.value = true
    })
  }

  function finishBackfill() {
    if (toValue(options.rows).length > 0) enableLiveEnter()
    else liveEnter.value = true
    applyViewportWindow()
  }

  function stopBackfill() {
    backfillGen += 1
    if (!backfillRaf) return
    cancelAnimationFrame(backfillRaf)
    backfillRaf = 0
  }

  function runBackfill(gen: number) {
    backfillRaf = 0
    if (gen !== backfillGen) return
    if (windowStart.value <= 0) {
      finishBackfill()
      return
    }
    const root = toValue(options.viewport)
    const prevHeight = root?.scrollHeight ?? 0
    windowStart.value = Math.max(0, windowStart.value - BACKFILL_PER_FRAME)
    void nextTick(() => {
      if (gen !== backfillGen) return
      const el = toValue(options.viewport)
      if (el) {
        if (toValue(options.atBottom)) options.pinIfNeeded()
        else el.scrollTop += el.scrollHeight - prevHeight
      }
      if (windowStart.value > 0) backfillRaf = requestAnimationFrame(() => runBackfill(gen))
      else finishBackfill()
    })
  }

  function scheduleBackfillAfterPaint() {
    stopBackfill()
    if (windowStart.value <= 0) {
      finishBackfill()
      return
    }
    liveEnter.value = false
    const gen = backfillGen
    backfillRaf = requestAnimationFrame(() => {
      if (gen !== backfillGen) return
      backfillRaf = requestAnimationFrame(() => runBackfill(gen))
    })
  }

  function armTailWindow() {
    liveEnter.value = false
    stopBackfill()
    boxByKey.clear()
    windowStart.value = lastTurnStartIndex(toValue(options.rows))
    applySlice(windowStart.value, toValue(options.rows).length, 0, 0)
  }

  watch(
    () => toValue(options.rows),
    (next, prev) => {
      if ((prev?.length ?? 0) === 0 && next.length > 0) {
        armTailWindow()
        return
      }
      if (windowStart.value > next.length) {
        windowStart.value = lastTurnStartIndex(next)
        applySlice(windowStart.value, next.length, 0, 0)
        return
      }
      if (windowStart.value > 0) {
        applySlice(windowStart.value, next.length, 0, 0)
        return
      }
      applyViewportWindow()
      if (toValue(options.atBottom)) void nextTick(options.pinIfNeeded)
    },
  )

  onBeforeUnmount(() => {
    stopBackfill()
    if (windowRaf) cancelAnimationFrame(windowRaf)
    rowObserver.disconnect()
    observed.clear()
  })

  return {
    windowStart,
    mountedFrom,
    mountedRows,
    mountedKeys,
    padTop,
    padBottom,
    liveEnter,
    windowed,
    bindRow,
    rowOffset,
    scheduleWindow,
    applyViewportWindow,
    armTailWindow,
    scheduleBackfillAfterPaint,
    stopBackfill,
  }
}
