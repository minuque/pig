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
      class="transcript-viewport"
      v-bind="containerProps"
      @scroll="onTranscriptScroll"
      @wheel="onWheel"
      @pointerdown="releasePinnedToBottom"
    >
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list" v-bind="wrapperProps">
          <TransitionGroup name="timeline-row" tag="div" class="timeline-rows" :css="liveEnter">
            <div
              v-for="item in windowList"
              :key="item.data.key"
              class="row"
              :class="[`row-${item.data.row.role}`, gapClass(item.index)]"
              :data-row-index="item.index"
              :data-minimap-row="item.data.row.role === 'user' ? item.data.row.id : undefined"
            >
              <UserMessage v-if="item.data.row.role === 'user'" :item="item.data.row" />
              <AssistantMessage
                v-else-if="item.data.row.role === 'assistant'"
                :item="item.data.row"
                :streaming="running && item.data.row.streaming"
              />
              <ToolSteps
                v-else-if="isToolRow(item.data.row)"
                :row="item.data.row"
                :is-expand="isExpand(item.data.row.id)"
                :expanded-tools="expandedTools"
                @toggle-expand="onToggleExpand(item.data.row.id, $event)"
                @toggle-tool="(id, open) => onToggleTool(item.data.row.id, id, open)"
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

const column = useTemplateRef<HTMLElement>("column")
const list = useTemplateRef<HTMLElement>("list")

const {
  list: windowList,
  containerProps,
  wrapperProps,
  measureVisible,
  stickToLatest,
  revealRow,
  resetHeights,
} = useTranscriptWindow(rows, rowKeys)

const viewport = containerProps.ref

function scrollerRoot(): HTMLElement | null {
  return viewport.value
}

function gapClass(index: number): string | undefined {
  const next = rows.value[index + 1]
  if (!next) return undefined
  if (next.role === "user") return "gap-before-user"
  if (rows.value[index]?.role === "user") return "gap-after-user"
  return "gap-default"
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
  syncLayout,
} = useTranscriptMinimap(rows, {
  viewport,
  column,
})

function onTranscriptScroll() {
  containerProps.onScroll()
  syncLayout(viewport.value, column.value)
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

async function selectMinimapItem(item: TranscriptMinimapItem) {
  const row = await revealRow(item.rowIndex)
  if (row) scrollToElement(row)
}

function observeSizes() {
  sizeObserver?.disconnect()
  sizeObserver = undefined
  const root = viewport.value
  const body = list.value
  if (!root && !body) return
  sizeObserver = new ResizeObserver(() => {
    const changed = measureVisible(root)
    syncLayout(viewport.value, column.value)
    if (changed) void nextTick(pinIfNeeded)
    else pinIfNeeded()
  })
  if (root) sizeObserver.observe(root)
  if (body) sizeObserver.observe(body)
}

const liveEnter = shallowRef(false)

function enableLiveEnter() {
  if (liveEnter.value) return
  void nextTick(() => {
    liveEnter.value = true
  })
}

watch(
  () => props.sessionId,
  () => {
    liveEnter.value = false
    resetHeights()
    reset()
  },
  { flush: "pre" },
)

watch(rows, (next, prev) => {
  if ((prev?.length ?? 0) === 0 && next.length > 0) {
    stickToLatest()
    scrollToLatest("auto")
  } else if (atBottom.value) void nextTick(pinIfNeeded)
  if (next.length > 0) enableLiveEnter()
})

watch(
  [viewport, list],
  ([, body], prev) => {
    observeSizes()
    if (body && !prev?.[1]) {
      stickToLatest()
      scrollToLatest("auto")
      if (rows.value.length > 0) enableLiveEnter()
      else liveEnter.value = true
    }
  },
  { flush: "post" },
)

onBeforeUnmount(() => sizeObserver?.disconnect())

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
  container-type: size;
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
.row.gap-default {
  padding-block-end: var(--spacing-md);
}
.row.gap-after-user {
  padding-block-end: var(--spacing-lg);
}
.row.gap-before-user {
  padding-block-end: var(--spacing-xl);
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
