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
          <div
            v-if="padTop > 0"
            class="timeline-spacer"
            :style="{ height: `${padTop}px` }"
            aria-hidden="true"
          ></div>
          <TransitionGroup
            name="timeline-row"
            tag="div"
            class="timeline-rows"
            :css="liveEnter && !windowed"
          >
            <div
              v-for="(row, index) in mountedRows"
              :key="mountedKeys[index] ?? row.id"
              :ref="(el) => bindRow(el, mountedKeys[index] ?? row.id)"
              class="row"
              :class="[`row-${row.role}`, transcriptRowGapClass(mountedFrom + index, rows)]"
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
          <div
            v-if="padBottom > 0"
            class="timeline-spacer"
            :style="{ height: `${padBottom}px` }"
            aria-hidden="true"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import { useTranscriptWindow } from "@features/transcript-view/hooks/use-transcript-window.js"
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
import { transcriptRowGapClass } from "@features/transcript-view/lib/transcript-window.js"

const props = defineProps<{
  sessionId: string
  transcript: readonly TranscriptItem[]
  running: boolean
  timings?: readonly TurnTiming[]
}>()

const rows = computed(() => buildTimelineRows(props.transcript, props.running, props.timings))
const rowKeys = computed(() => timelineRowKeys(rows.value))

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

const {
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
} = useTranscriptWindow({
  rows,
  keys: rowKeys,
  running: () => props.running,
  atBottom,
  viewport,
  pinIfNeeded,
})

let sizeObserver: ResizeObserver | undefined

const {
  items: minimapItems,
  inViewIds,
  hitStripWidth,
} = useTranscriptMinimap(rows, { viewport, column }, mountedKeys)

function onTranscriptScroll() {
  onScroll()
  scheduleWindow()
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
  if (target) {
    scrollToElement(target)
    return
  }
  if (!root) return
  releasePinnedToBottom()
  atBottom.value = false
  root.scrollTop = rowOffset(item.rowIndex)
  applyViewportWindow()
  void nextTick(() => {
    const el = root.querySelector<HTMLElement>(`[data-minimap-row="${CSS.escape(item.id)}"]`)
    if (el) scrollToElement(el)
  })
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
  }
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
.timeline-rows {
  box-sizing: border-box;
  width: 100%;
}

.timeline-spacer {
  box-sizing: border-box;
  width: 100%;
  flex-shrink: 0;
  pointer-events: none;
}

.row {
  box-sizing: border-box;
  width: 100%;
  contain: layout style;
}
.row-gap {
  padding-top: var(--spacing-md);
}
.row-gap-turn {
  padding-top: var(--spacing-lg);
}
.row-gap-user {
  padding-top: var(--spacing-xl);
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
