<template>
  <div class="transcript-shell">
    <TranscriptMinimap
      v-if="rows.length && minimapItems.length >= MINIMAP_MIN_ITEMS"
      :items="minimapItems"
      :in-view-ids="inViewIds"
      :hit-strip-width="hitStripWidth"
      @select="selectMinimapItem"
    />

    <div
      id="transcript-panel"
      ref="viewport"
      class="transcript-viewport"
      @scroll="onTranscriptScroll"
      @wheel="onWheel"
      @pointerdown="releasePinnedToBottom"
    >
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <TransitionGroup
            name="timeline-row"
            tag="div"
            class="timeline-rows"
            :class="{ 'is-paint-skip': paintSkip }"
            :css="liveEnter"
          >
            <div
              v-for="(row, index) in mountedRows"
              :key="mountedKeys[index] ?? row.id"
              class="row"
              :class="`row-${row.role}`"
              :data-minimap-row="row.role === 'user' ? row.id : undefined"
            >
              <UserMessage v-if="row.role === 'user'" :item="row" />
              <AssistantMessage
                v-else-if="row.role === 'assistant'"
                :item="row"
                :streaming="running && row.streaming"
              />
              <ToolSteps
                v-else-if="isToolRow(row)"
                :row="row"
                :is-expand="isExpand(row.id)"
                :expanded-tools="expandedTools"
                @toggle-expand="onToggleExpand(row.id, $event)"
                @toggle-tool="(id, open) => onToggleTool(row.id, id, open)"
              />
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TranscriptMinimapItem } from "@features/transcript-view/type.js"
import {
  buildTimelineRows,
  isToolRow,
  timelineRowKeys,
} from "@features/transcript-view/lib/transcript-rows.js"
import { shouldShowScrollToLatest } from "@features/transcript-view/lib/transcript-scroll.js"
import { lastTurnStartIndex } from "@features/transcript-view/lib/transcript-window.js"

const BACKFILL_PER_FRAME = 8

const props = defineProps<{
  sessionId: string
  transcript: readonly TranscriptItem[]
  running: boolean
  timings?: readonly TurnTiming[]
}>()

const rows = computed(() => buildTimelineRows(props.transcript, props.running, props.timings))
const rowKeys = computed(() => timelineRowKeys(rows.value))
const windowStart = shallowRef(lastTurnStartIndex(rows.value))
const mountedRows = computed(() => rows.value.slice(windowStart.value))
const mountedKeys = computed(() => rowKeys.value.slice(windowStart.value))

const { expandedTools, isExpand, toggleExpand, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)

const viewport = useTemplateRef<HTMLElement>("viewport")
const column = useTemplateRef<HTMLElement>("column")
const list = useTemplateRef<HTMLElement>("list")

function scrollerRoot(): HTMLElement | null {
  return viewport.value
}

const {
  atBottom,
  visuallyAtBottom,
  pinIfNeeded,
  releasePinnedToBottom,
  reset,
  onScroll,
  onWheel,
  scrollToLatest,
  scrollToElement,
} = useTranscriptFollow(scrollerRoot)

const showScrollToLatest = computed(() =>
  shouldShowScrollToLatest(props.transcript.length, visuallyAtBottom.value),
)

let sizeObserver: ResizeObserver | undefined

const {
  items: minimapItems,
  inViewIds,
  hitStripWidth,
} = useTranscriptMinimap(rows, { viewport, column }, mountedKeys)

function onTranscriptScroll() {
  onScroll()
}

function onToggleExpand(id: string, open: boolean) {
  releasePinnedToBottom()
  atBottom.value = false
  toggleExpand(id, open)
}

function onToggleTool(rowId: string, id: string, open: boolean) {
  releasePinnedToBottom()
  atBottom.value = false
  if (open) toggleExpand(rowId, true)
  toggleTool(id, open)
}

function selectMinimapItem(item: TranscriptMinimapItem) {
  const root = scrollerRoot()
  const target = root?.querySelector<HTMLElement>(`[data-minimap-row="${CSS.escape(item.id)}"]`)
  if (target) scrollToElement(target)
}

function observeSizes() {
  sizeObserver?.disconnect()
  sizeObserver = undefined
  const root = viewport.value
  const body = list.value
  if (!root && !body) return
  sizeObserver = new ResizeObserver(() => {
    pinIfNeeded()
  })
  if (root) sizeObserver.observe(root)
  if (body) sizeObserver.observe(body)
}

const liveEnter = shallowRef(false)
const paintSkip = shallowRef(false)
let backfillRaf = 0
let backfillGen = 0
let paintSkipTimer = 0
let paintSkipObserver: ResizeObserver | undefined

const PAINT_SKIP_SETTLE_MS = 80

function enableLiveEnter() {
  if (liveEnter.value) return
  void nextTick(() => {
    liveEnter.value = true
  })
}

function stampRowIntrinsicSizes(body: HTMLElement) {
  for (const row of body.querySelectorAll<HTMLElement>(".row")) {
    const height = row.getBoundingClientRect().height
    if (height > 0) row.style.containIntrinsicBlockSize = `${Math.ceil(height)}px`
  }
}

function clearRowIntrinsicSizes(body: HTMLElement | null) {
  if (!body) return
  for (const row of body.querySelectorAll<HTMLElement>(".row")) {
    row.style.containIntrinsicBlockSize = ""
  }
}

function cancelPaintSkip() {
  paintSkip.value = false
  clearRowIntrinsicSizes(list.value)
  if (paintSkipTimer) {
    window.clearTimeout(paintSkipTimer)
    paintSkipTimer = 0
  }
  paintSkipObserver?.disconnect()
  paintSkipObserver = undefined
}

function armPaintSkip() {
  cancelPaintSkip()
  const body = list.value
  if (!body) {
    paintSkip.value = true
    return
  }
  const settle = () => {
    paintSkipTimer = 0
    paintSkipObserver?.disconnect()
    paintSkipObserver = undefined
    stampRowIntrinsicSizes(body)
    paintSkip.value = true
  }
  paintSkipObserver = new ResizeObserver(() => {
    if (paintSkipTimer) window.clearTimeout(paintSkipTimer)
    paintSkipTimer = window.setTimeout(settle, PAINT_SKIP_SETTLE_MS)
  })
  paintSkipObserver.observe(body)
  paintSkipTimer = window.setTimeout(settle, PAINT_SKIP_SETTLE_MS)
}

function finishBackfill() {
  if (rows.value.length > 0) enableLiveEnter()
  else liveEnter.value = true
  armPaintSkip()
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
  const root = viewport.value
  const prevHeight = root?.scrollHeight ?? 0
  windowStart.value = Math.max(0, windowStart.value - BACKFILL_PER_FRAME)
  void nextTick(() => {
    if (gen !== backfillGen) return
    const el = viewport.value
    if (el) {
      if (atBottom.value) pinIfNeeded()
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
  cancelPaintSkip()
  stopBackfill()
  windowStart.value = lastTurnStartIndex(rows.value)
}

watch(
  () => props.sessionId,
  () => {
    armTailWindow()
    reset()
    void nextTick(() => {
      scrollToLatest("auto")
      scheduleBackfillAfterPaint()
    })
  },
  { flush: "pre" },
)

watch(rows, (next, prev) => {
  if ((prev?.length ?? 0) === 0 && next.length > 0) {
    armTailWindow()
    scrollToLatest("auto")
    scheduleBackfillAfterPaint()
    return
  }
  if (windowStart.value > next.length) windowStart.value = lastTurnStartIndex(next)
  else if (atBottom.value) void nextTick(pinIfNeeded)
})

watch(
  [viewport, list],
  ([, body], prev) => {
    observeSizes()
    if (body && !prev?.[1]) {
      scrollToLatest("auto")
      scheduleBackfillAfterPaint()
    }
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  cancelPaintSkip()
  stopBackfill()
})

defineExpose({ showScrollToLatest, scrollToLatest })
</script>

<style scoped>
.transcript-shell {
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.transcript-viewport {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: none;
  overscroll-behavior: contain;
}
.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}

.transcript {
  box-sizing: border-box;
  width: min(100%, var(--size-content));
  min-width: 0;
  margin-inline: auto;
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--size-composer-overlay));
}

.transcript-list,
.timeline-rows,
.row {
  box-sizing: border-box;
  width: 100%;
}

.timeline-rows.is-paint-skip .row {
  content-visibility: auto;
}

.row + .row {
  margin-block-start: var(--spacing-md);
}
.row-user + .row {
  margin-block-start: var(--spacing-lg);
}

.row + .row-user {
  margin-block-start: var(--spacing-xl);
}

.row :deep(.stamp) {
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.row:hover :deep(.stamp),
.row:focus-within :deep(.stamp),
.row :deep(.stamp.is-copied),
.row :deep(.stamp.is-error) {
  opacity: 1;
  pointer-events: auto;
}

@media (hover: none) {
  .row :deep(.stamp) {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
