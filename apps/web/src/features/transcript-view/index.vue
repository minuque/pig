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
      @wheel="onTranscriptWheel"
      @pointerdown="onTranscriptPointerDown"
    >
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <div v-if="loadingOlder" class="older-busy">加载更早消息</div>
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
  shouldLoadOlderTranscript,
  shouldShowScrollToLatest,
} from "@features/transcript-view/lib/transcript-scroll.js"
import { historyPrepended } from "@features/transcript-view/lib/transcript-window.js"

const props = withDefaults(
  defineProps<{
    sessionId: string
    transcript: readonly TranscriptItem[]
    running: boolean
    timings?: readonly TurnTiming[]
    hasMore?: boolean
    loadingOlder?: boolean
  }>(),
  { hasMore: false, loadingOlder: false },
)

const emit = defineEmits<{
  firstTextPaint: []
  loadOlder: []
}>()

const rows = computed(() => buildTimelineRows(props.transcript, props.running, props.timings))
const mountedRows = rows
const mountedKeys = computed(() => timelineRowKeys(rows.value))

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

function maybeLoadOlder() {
  const top = scrollerRoot()?.scrollTop ?? 0
  if (!shouldLoadOlderTranscript(props.hasMore, props.loadingOlder, atBottom.value, top)) return
  emit("loadOlder")
}

function onTranscriptScroll() {
  onScroll()
  maybeLoadOlder()
}

function onTranscriptWheel(event: WheelEvent) {
  onWheel(event)
  maybeLoadOlder()
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
let revealGen = 0
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
  if (gen !== revealGen) return
  paintSkip.value = true
  pinIfNeeded()
  if (rows.value.length > 0) emit("firstTextPaint")
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

function stopReveal() {
  revealGen += 1
  if (paintRaf) {
    cancelAnimationFrame(paintRaf)
    paintRaf = 0
  }
  releaseTail()
}

/** 当前页稳住后再揭开。更早内容只在上翻时分页拉取。 */
function scheduleRevealAfterPaint() {
  if (paintSkip.value) {
    pinIfNeeded()
    return
  }
  stopReveal()
  holdTail()
  const gen = revealGen
  void nextTick(() => {
    if (gen !== revealGen) return
    paintRaf = requestAnimationFrame(() => {
      paintRaf = 0
      if (gen !== revealGen) return
      armPaintSkip(gen)
    })
  })
}

function armTailWindow() {
  liveEnter.value = false
  cancelPaintSkip()
  stopReveal()
}

onMounted(() => {
  holdTail()
  scrollToLatest("auto")
  scheduleRevealAfterPaint()
})

watch(
  () => props.sessionId,
  () => {
    armTailWindow()
    reset()
    void nextTick(() => {
      scrollToLatest("auto")
      scheduleRevealAfterPaint()
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
      scheduleRevealAfterPaint()
    })
    return
  }
  if (historyPrepended(previous, next) && !atBottom.value) {
    const root = scrollerRoot()
    const beforeHeight = root?.scrollHeight ?? 0
    const beforeTop = root?.scrollTop ?? 0
    void nextTick(() => {
      if (root) restoreScrollAfterPrepend(root, beforeHeight, beforeTop)
    })
    return
  }
  if (atBottom.value) void nextTick(pinIfNeeded)
})

watch(
  [viewport, list],
  ([, body], prev) => {
    observeSizes()
    if (body && !prev?.[1]) {
      scrollToLatest("auto")
      scheduleRevealAfterPaint()
    }
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  sizeObserver?.disconnect()
  if (pinRaf) cancelAnimationFrame(pinRaf)
  cancelPaintSkip()
  stopReveal()
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

.older-busy {
  padding: var(--spacing-sm) 0;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  text-align: center;
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
