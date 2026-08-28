<template>
  <div class="transcript-viewport">
    <section
      id="transcript-panel"
      ref="region"
      class="transcript-region"
      :aria-labelledby="transcriptTitleId"
      @wheel="onTranscriptWheel"
      @pointerdown="releasePinnedToBottom"
    >
      <MarkstreamVirtualTimeline
        v-if="rows.length"
        ref="timeline"
        class="transcript"
        :thread-key="sessionId"
        :measurement-key="measurementKey"
        :items="rows"
        :get-key="rowKey"
        :get-kind="transcriptRowKind"
        :get-content="transcriptRowContent"
        :get-final="transcriptRowFinal"
        :estimate-item-height="estimateTranscriptRowHeight"
        markdown-mode="chat"
        :stick-to-bottom="'auto'"
        :overscan="8"
        :initial-thread-state="pinnedThreadState"
        @thread-state-change="onThreadState"
      >
        <template #default="{ item: row, measureRef, markdownProps }">
          <div
            :ref="measureRef"
            class="row"
            :data-minimap-row="row.role === 'user' ? row.id : undefined"
          >
            <UserMessage v-if="row.role === 'user'" :item="row" />
            <AssistantMessage
              v-else-if="row.role === 'assistant'"
              :item="row"
              :streaming="running && row.streaming"
              :timeline-markdown="markdownProps"
              @render-pending="onMarkdownPending(row.id)"
              @render-settled="onMarkdownSettled(row.id)"
            />
            <div v-else-if="isThinkingRow(row)" class="thinking-row">
              <ThinkingOrb />
              <ThinkingState text="思考中…" />
            </div>
            <WorkRow
              v-else-if="isWorkRow(row)"
              :row="row"
              :fold-open="isFoldOpen(row.id)"
              :expanded-tools="expandedTools"
              @toggle-fold="toggleFold(row.id)"
              @toggle-tool="toggleTool"
            />
          </div>
        </template>
      </MarkstreamVirtualTimeline>
      <TranscriptMinimap
        v-if="rows.length && minimapItems.length >= MINIMAP_MIN_ITEMS"
        :items="minimapItems"
        :in-view-ids="inViewIds"
        :hit-strip-width="hitStripWidth"
        @select="selectMinimapItem"
      />
    </section>

    <div v-show="showScrollToLatest" class="session-floating-controls">
      <Button
        class="floating-control scroll-latest-control"
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="滚动到底部"
        title="滚动到底部"
        @click="scrollToLatest"
      >
        <ArrowDown />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import { ArrowDown } from "lucide-vue-next"
import { MarkstreamVirtualTimeline, type MarkstreamThreadVirtualState } from "markstream-vue"
import { leftPanelKey } from "@components/layout/hooks/use-left-panel.js"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ThinkingState from "@features/transcript-view/components/ThinkingState.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import WorkRow from "@features/transcript-view/components/WorkRow.vue"
import { Button } from "@components/ui/button/index.js"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import {
  MINIMAP_MIN_ITEMS,
  type TranscriptMinimapItem,
} from "@features/transcript-view/lib/transcript-minimap.js"
import type { TranscriptItem } from "@features/transcript-view/lib/transcript-format.js"
import {
  buildTimelineRows,
  estimateTranscriptRowHeight,
  isThinkingRow,
  isWorkRow,
  transcriptRowContent,
  transcriptRowFinal,
  transcriptRowKind,
} from "@features/transcript-view/lib/transcript-rows.js"
import {
  isMarkdownStreamReady,
  isTranscriptVisuallyAtBottom,
  MARKDOWN_STREAM_READY_TIMEOUT_MS,
  PROGRAMMATIC_BOTTOM_HOLD_MS,
  shouldHoldProgrammaticBottom,
  shouldShowScrollToLatest,
  threadStatePinnedToBottom,
  unpinBottomScrollTop,
} from "@features/transcript-view/lib/transcript-scroll.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const props = defineProps<{
  sessionId: string
  /** 官方 TranscriptItem 列表：RemoteSession 维护的投影 */
  transcript: readonly TranscriptItem[]
  /** 运行中显示 streaming 空态 */
  running: boolean
  /** 上次离开该会话时的虚拟滚动状态：只复用行高，打开时贴底 */
  threadState: MarkstreamThreadVirtualState | null
}>()

const emit = defineEmits<{
  "thread-state": [state: MarkstreamThreadVirtualState]
  ready: []
}>()

const rows = computed(() => buildTimelineRows(props.transcript, props.running))
const { expandedTools, isFoldOpen, toggleFold, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)
const pinnedThreadState = computed(() => threadStatePinnedToBottom(props.threadState))
const transcriptTitleId = computed(() => `transcript-title-${props.sessionId}`)
const region = useTemplateRef<HTMLElement>("region")
const { isDark } = useColorScheme()
const measurementKey = computed(() => (isDark.value ? "dark" : "light"))
const panel = inject(leftPanelKey, null)
const sidebarResizing = computed(() => panel?.resizing.value ?? false)
const { items: minimapItems, inViewIds, hitStripWidth, syncLayout } = useTranscriptMinimap(rows)

function rowKey(item: { id: string }): string {
  return item.id
}

const pendingMarkdownIds = new Set<string>()
let markdownMounted = false
let streamReadyEmitted = false
let readyTimer = 0

function hasMarkdownRows(): boolean {
  return rows.value.some((row) => row.role === "assistant" && Boolean(row.text))
}

function emitStreamReady() {
  if (streamReadyEmitted) return
  streamReadyEmitted = true
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = 0
  }
  emit("ready")
  if (atBottom.value) scrollToLatest()
}

function resetStreamReady() {
  pendingMarkdownIds.clear()
  markdownMounted = false
  streamReadyEmitted = false
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = 0
  }
}

function checkStreamReady() {
  if (isMarkdownStreamReady(hasMarkdownRows(), pendingMarkdownIds.size, markdownMounted)) {
    emitStreamReady()
  }
}

function onMarkdownPending(id: string) {
  if (streamReadyEmitted) return
  pendingMarkdownIds.add(id)
  markdownMounted = true
}

function onMarkdownSettled(id: string) {
  if (streamReadyEmitted) return
  pendingMarkdownIds.delete(id)
  markdownMounted = true
  void nextTick(checkStreamReady)
}

const timeline = useTemplateRef<{
  scrollToBottom(): void
  scrollToIndex(index: number, align?: "start" | "center" | "end"): void
  captureThreadState(): MarkstreamThreadVirtualState
  restoreThreadState(state: MarkstreamThreadVirtualState): void
}>("timeline")
const atBottom = shallowRef(true)
const showScrollToLatest = computed(() =>
  shouldShowScrollToLatest(props.transcript.length, atBottom.value),
)
let bottomHoldUntil = 0
let pinRaf = 0

function timelineScrollRoot(): HTMLElement | null {
  return region.value?.querySelector<HTMLElement>(".markstream-virtual-timeline") ?? null
}

function releasePinnedToBottom() {
  if (pinRaf) {
    cancelAnimationFrame(pinRaf)
    pinRaf = 0
  }
  bottomHoldUntil = 0
}

function onTranscriptWheel(event: WheelEvent) {
  releasePinnedToBottom()
  const root = timelineScrollRoot()
  if (!root) return
  const nextTop = unpinBottomScrollTop(
    root.scrollHeight,
    root.scrollTop,
    root.clientHeight,
    event.deltaY,
  )
  if (nextTop !== null) {
    event.preventDefault()
    root.scrollTop = nextTop
    return
  }
  const onScroller = event.target instanceof Node && root.contains(event.target)
  if (onScroller || event.deltaY === 0) return
  event.preventDefault()
  root.scrollTop += event.deltaY
}

function jumpToBottom() {
  const api = timeline.value
  const root = timelineScrollRoot()
  if (root?.classList.contains("is-restoring-thread") && api) {
    api.restoreThreadState({
      ...api.captureThreadState(),
      outerAnchor: { type: "bottom", distanceFromBottomPx: 0 },
    })
    return
  }
  api?.scrollToBottom()
  if (root) root.scrollTop = root.scrollHeight - root.clientHeight
}

function onThreadState(state: MarkstreamThreadVirtualState) {
  const root = timelineScrollRoot()
  syncLayout(region.value, root)
  const bottom = root
    ? isTranscriptVisuallyAtBottom(root.scrollHeight, root.scrollTop, root.clientHeight)
    : state.outerAnchor?.type !== "item"
  if (shouldHoldProgrammaticBottom(bottom, bottomHoldUntil, performance.now())) return
  atBottom.value = bottom
  if (!streamReadyEmitted) {
    requestAnimationFrame(() => {
      if (!streamReadyEmitted) checkStreamReady()
    })
  }
}

function selectMinimapItem(item: TranscriptMinimapItem) {
  releasePinnedToBottom()
  timeline.value?.scrollToIndex(item.rowIndex, "start")
  const root = timelineScrollRoot()
  if (
    root &&
    atBottom.value &&
    !isTranscriptVisuallyAtBottom(root.scrollHeight, root.scrollTop, root.clientHeight)
  ) {
    atBottom.value = false
  }
}

function scrollToLatest() {
  const holdUntil = performance.now() + PROGRAMMATIC_BOTTOM_HOLD_MS
  bottomHoldUntil = holdUntil
  atBottom.value = true
  if (pinRaf) cancelAnimationFrame(pinRaf)
  const tick = () => {
    jumpToBottom()
    if (performance.now() < holdUntil) pinRaf = requestAnimationFrame(tick)
    else pinRaf = 0
  }
  tick()
}

defineExpose({ prepareForSubmit: scrollToLatest })

function persistThreadState(expectedSessionId = props.sessionId) {
  const captured = timeline.value?.captureThreadState()
  if (captured?.threadKey === expectedSessionId) emit("thread-state", captured)
}

watch(
  () => props.sessionId,
  (_sessionId, previousSessionId) => {
    persistThreadState(previousSessionId)
    releasePinnedToBottom()
    atBottom.value = true
  },
  { flush: "pre" },
)
watch(
  () => props.sessionId,
  () => {
    resetStreamReady()
    readyTimer = window.setTimeout(emitStreamReady, MARKDOWN_STREAM_READY_TIMEOUT_MS)
  },
  { immediate: true },
)
watch(
  rows,
  () => {
    if (streamReadyEmitted) return
    if (rows.value.length === 0) emitStreamReady()
  },
  { immediate: true, flush: "post" },
)
watch(
  () => props.sessionId,
  () => {
    if (rows.value.length === 0) return
    scrollToLatest()
  },
  { immediate: true, flush: "post" },
)
watch(rows, (next, prev) => {
  if (prev.length === 0 && next.length > 0) scrollToLatest()
})

let layoutObserver: ResizeObserver | undefined
watch(
  region,
  (el) => {
    layoutObserver?.disconnect()
    layoutObserver = undefined
    if (!el) return
    const tick = () => {
      const root = timelineScrollRoot()
      syncLayout(el, root)
      if (sidebarResizing.value || !atBottom.value) return
      jumpToBottom()
    }
    layoutObserver = new ResizeObserver(tick)
    layoutObserver.observe(el)
    tick()
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  layoutObserver?.disconnect()
  releasePinnedToBottom()
  persistThreadState()
  resetStreamReady()
})
</script>

<style scoped>
.transcript-viewport {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .transcript-viewport {
    animation: none;
  }
}
.transcript-region {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  background: transparent;
}
.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}
.session-floating-controls {
  position: absolute;
  inset-inline: var(--spacing-md);
  bottom: var(--spacing-sm);
  z-index: 2;
  max-width: var(--size-composer);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  pointer-events: none;
}
.floating-control {
  pointer-events: auto;
}
.scroll-latest-control {
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
  color: var(--ink-secondary);
  box-shadow: var(--shadow-float);
}
@media (max-width: 900px) {
  .session-floating-controls {
    inset-inline: var(--spacing-sm);
  }
}
.transcript,
.transcript:hover {
  --scrollbar-thumb: #0000;
  scrollbar-width: none;
}
.transcript {
  box-sizing: border-box;
  flex: none;
  align-self: stretch;
  width: min(100%, var(--size-content));
  min-width: 0;
  min-height: 0;
  padding-top: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  overscroll-behavior: contain;
}
.transcript::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.transcript :deep(.markstream-virtual-timeline__item) {
  box-sizing: border-box;
  width: 100%;
}
.transcript :deep(.markstream-virtual-timeline__restore-loading) {
  display: none;
}
.transcript
  :deep(.markstream-virtual-timeline.is-restoring-thread > .markstream-virtual-timeline__spacer),
.transcript
  :deep(.markstream-virtual-timeline.is-restoring-thread > .markstream-virtual-timeline__item) {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}
.thinking-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 20px;
  margin-bottom: var(--spacing-lg);
  color: var(--ink-faint);
}
</style>
