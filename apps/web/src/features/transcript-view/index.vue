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
      :class="{ 'is-following': atBottom }"
      @scroll="onTranscriptScroll"
      @wheel="onWheel"
      @pointerdown="onTranscriptPointerDown"
    >
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <TransitionGroup
            name="timeline-row"
            tag="div"
            class="timeline-rows"
            :class="{ 'is-paint-skip': paintSkip || running }"
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
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue"
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
import {
  restoreScrollAfterPrepend,
  shouldShowScrollToLatest,
} from "@features/transcript-view/lib/transcript-scroll.js"
import {
  historyPrepended,
  lastTurnStartIndex,
  recutWindowStartOnPrepend,
} from "@features/transcript-view/lib/transcript-window.js"

const BACKFILL_PER_FRAME = 2

const props = defineProps<{
  sessionId: string
  transcript: readonly TranscriptItem[]
  running: boolean
  timings?: readonly TurnTiming[]
}>()

const emit = defineEmits<{
  firstTextPaint: []
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
  holdTail,
  releaseTail,
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
let pinRaf = 0

function schedulePin() {
  if (pinRaf) return
  pinRaf = requestAnimationFrame(() => {
    pinRaf = 0
    pinIfNeeded()
  })
}

const {
  items: minimapItems,
  inViewIds,
  hitStripWidth,
} = useTranscriptMinimap(rows, { viewport, column }, mountedKeys)

function onTranscriptScroll() {
  onScroll()
}

function onTranscriptPointerDown() {
  releaseTail()
  releasePinnedToBottom()
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
  sizeObserver = new ResizeObserver(schedulePin)
  if (root) sizeObserver.observe(root)
  if (body) sizeObserver.observe(body)
}

const liveEnter = shallowRef(false)
const paintSkip = shallowRef(false)
let backfillRaf = 0
let backfillGen = 0
let idleStart = 0
let idleViaRic = false
let paintRaf = 0
let paintSkipTimer = 0
let paintSkipObserver: ResizeObserver | undefined

const PAINT_SKIP_SETTLE_MS = 120

function enableLiveEnter() {
  if (liveEnter.value) return
  void nextTick(() => {
    liveEnter.value = true
  })
}

function cancelPaintSkip() {
  paintSkip.value = false
  if (paintSkipTimer) {
    window.clearTimeout(paintSkipTimer)
    paintSkipTimer = 0
  }
  paintSkipObserver?.disconnect()
  paintSkipObserver = undefined
}

function revealLastTurn(gen: number) {
  paintSkip.value = true
  pinIfNeeded()
  if (rows.value.length > 0) emit("firstTextPaint")
  if (windowStart.value > 0) {
    liveEnter.value = false
    scheduleIdleBackfill(gen)
    return
  }
  enableLiveEnter()
  releaseTail()
}

function armPaintSkip(gen: number) {
  cancelPaintSkip()
  const body = list.value
  const settle = () => {
    paintSkipTimer = 0
    paintSkipObserver?.disconnect()
    paintSkipObserver = undefined
    if (gen !== backfillGen) return
    revealLastTurn(gen)
  }
  if (!body) {
    revealLastTurn(gen)
    return
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
  pinIfNeeded()
  releaseTail()
}

function cancelIdleStart() {
  if (!idleStart) return
  if (idleViaRic && typeof cancelIdleCallback === "function") cancelIdleCallback(idleStart)
  else window.clearTimeout(idleStart)
  idleStart = 0
}

function cancelPaintRaf() {
  if (!paintRaf) return
  cancelAnimationFrame(paintRaf)
  paintRaf = 0
}

function stopBackfill() {
  backfillGen += 1
  cancelIdleStart()
  cancelPaintRaf()
  releaseTail()
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
  const root = scrollerRoot()
  const beforeHeight = root?.scrollHeight ?? 0
  const beforeTop = root?.scrollTop ?? 0
  windowStart.value = Math.max(0, windowStart.value - BACKFILL_PER_FRAME)
  void nextTick(() => {
    if (gen !== backfillGen) return
    if (atBottom.value) pinIfNeeded()
    else if (root) restoreScrollAfterPrepend(root, beforeHeight, beforeTop)
    if (windowStart.value > 0) backfillRaf = requestAnimationFrame(() => runBackfill(gen))
    else finishBackfill()
  })
}

function scheduleIdleBackfill(gen: number) {
  const start = () => {
    idleStart = 0
    if (gen !== backfillGen) return
    backfillRaf = requestAnimationFrame(() => runBackfill(gen))
  }
  if (typeof requestIdleCallback === "function") {
    idleViaRic = true
    idleStart = requestIdleCallback(start, { timeout: 200 })
    return
  }
  idleViaRic = false
  idleStart = window.setTimeout(start, 0)
}

/** 末条公式/Markdown 稳住后再揭开，随后 idle 回填更早行。 */
function scheduleBackfillAfterPaint() {
  const alreadyShown = paintSkip.value
  stopBackfill()
  holdTail()
  const gen = backfillGen
  if (alreadyShown) {
    if (windowStart.value > 0) scheduleIdleBackfill(gen)
    else finishBackfill()
    return
  }
  void nextTick(() => {
    if (gen !== backfillGen) return
    paintRaf = requestAnimationFrame(() => {
      paintRaf = 0
      if (gen !== backfillGen) return
      armPaintSkip(gen)
    })
  })
}

function armTailWindow() {
  liveEnter.value = false
  cancelPaintSkip()
  stopBackfill()
  windowStart.value = lastTurnStartIndex(rows.value)
}

onMounted(() => {
  holdTail()
  scrollToLatest("auto")
  scheduleBackfillAfterPaint()
})

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
  const previous = prev ?? []
  if (previous.length === 0 && next.length > 0) {
    armTailWindow()
    void nextTick(() => {
      scrollToLatest("auto")
      scheduleBackfillAfterPaint()
    })
    return
  }
  const recut = recutWindowStartOnPrepend(previous, next, windowStart.value, atBottom.value)
  if (recut !== windowStart.value) {
    windowStart.value = recut
    if (historyPrepended(previous, next) && atBottom.value) {
      holdTail()
      void nextTick(() => {
        scrollToLatest("auto")
        scheduleBackfillAfterPaint()
      })
      return
    }
  }
  if (atBottom.value) void nextTick(pinIfNeeded)
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
  if (pinRaf) cancelAnimationFrame(pinRaf)
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
  overflow-anchor: auto;
  overscroll-behavior: contain;
}
.transcript-viewport.is-following {
  overflow-anchor: none;
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
.timeline-rows:not(.is-paint-skip) {
  visibility: hidden;
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
