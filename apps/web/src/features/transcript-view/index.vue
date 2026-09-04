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
      <div ref="inputBar" class="chat-input-bar">
        <div class="chat-input-stack">
          <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
            <Button
              class="scroll-latest-control"
              type="button"
              variant="outline"
              size="icon-sm"
              title="滚动到底部"
              @click="scrollToLatest"
            >
              <span class="icon-swap">
                <Ellipsis :data-visible="running" />
                <ArrowDown :data-visible="!running" />
              </span>
            </Button>
          </div>
          <ChatInput
            v-model:prompt="prompt"
            v-model:preset="preset"
            :catalog="catalog"
            :running="running"
            :aborting="aborting"
            :error="sessionError"
            :cwd="sessionCwd"
            :usage="contextUsage"
            :session-id="sessionId"
            @send="submitFromInput"
            @abort="abortSession"
          />
        </div>
      </div>
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <TransitionGroup name="timeline-row" tag="div" class="timeline-rows">
            <div
              v-for="row in rows"
              :key="row.id"
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
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue"
import { ArrowDown, Ellipsis } from "@lucide/vue"
import ChatInput from "@features/chat-input/index.vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import { Button } from "@components/ui/button/index.js"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TranscriptMinimapItem } from "@features/transcript-view/type.js"
import { buildTimelineRows, isToolRow } from "@features/transcript-view/lib/transcript-rows.js"
import { shouldShowScrollToLatest } from "@features/transcript-view/lib/transcript-scroll.js"
import { useSession } from "@features/session-workbench/index.js"

const props = defineProps<{
  sessionId: string
  transcript: readonly TranscriptItem[]
  running: boolean
  timings?: readonly TurnTiming[]
}>()

const {
  prompt,
  preset,
  catalog,
  aborting,
  sessionError,
  sessionCwd,
  contextUsage,
  abortSession,
  submitText,
} = useSession()
const rows = computed(() => buildTimelineRows(props.transcript, props.running, props.timings))
const { expandedTools, isExpand, toggleExpand, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)
const viewport = useTemplateRef<HTMLElement>("viewport")
const inputBar = useTemplateRef<HTMLElement>("inputBar")
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
  syncLayout,
} = useTranscriptMinimap(rows, {
  viewport,
  inputBar,
  column,
})

function onTranscriptScroll() {
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

function selectMinimapItem(item: TranscriptMinimapItem) {
  const root = scrollerRoot()
  const target = root?.querySelector<HTMLElement>(`[data-minimap-row="${CSS.escape(item.id)}"]`)
  if (target) scrollToElement(target)
}

function submitFromInput(text: string) {
  scrollToLatest()
  const sent = submitText(text)
  void nextTick(pinIfNeeded)
  return sent
}

function observeSizes() {
  sizeObserver?.disconnect()
  sizeObserver = undefined
  const root = viewport.value
  const body = list.value
  if (!root && !body) return
  sizeObserver = new ResizeObserver(() => {
    syncLayout(viewport.value, column.value)
    pinIfNeeded()
  })
  if (root) sizeObserver.observe(root)
  if (body) sizeObserver.observe(body)
}

watch(() => props.sessionId, reset, { flush: "pre" })
watch(rows, (next, prev) => {
  if ((prev?.length ?? 0) === 0 && next.length > 0) scrollToLatest()
  else if (atBottom.value) void nextTick(pinIfNeeded)
})
watch(
  [viewport, list],
  ([, body], prev) => {
    observeSizes()
    if (body && !prev?.[1]) scrollToLatest()
  },
  { flush: "post" },
)

onBeforeUnmount(() => sizeObserver?.disconnect())
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
@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }
}
.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}
.chat-input-bar {
  position: sticky;
  top: calc(100cqh - var(--size-chat-input-overlay));
  z-index: 2;
  height: 0;
  overflow: visible;
  pointer-events: none;
}
.chat-input-stack {
  position: relative;
  width: 100%;
  max-width: var(--size-chat-input);
  margin-inline: auto;
}
.session-floating-controls {
  position: absolute;
  top: 0;
  right: var(--spacing-sm);
  z-index: 11;
  display: flex;
  justify-content: flex-end;
  height: 0;
  overflow: visible;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.session-floating-controls.shown {
  opacity: 1;
}
.session-floating-controls.shown .scroll-latest-control {
  pointer-events: auto;
}
.scroll-latest-control {
  width: var(--size-scroll-control);
  height: var(--size-scroll-control);
  border-radius: var(--radius-full);
  background: var(--code-body);
  color: var(--ink-secondary);
  box-shadow: none;
  transform: translateY(calc(-100% - var(--spacing-sm)));
}
.chat-input-bar :deep(.prompt) {
  pointer-events: auto;
}
/* 输入卡底圆角缺口用对话列底色填实，避免 transcript 从左右下角透出 */
.chat-input-bar :deep(.glass-shell) {
  background-image:
    radial-gradient(
      circle at 100% 0,
      transparent var(--radius-xl),
      var(--surface) var(--radius-xl)
    ),
    radial-gradient(circle at 0 0, transparent var(--radius-xl), var(--surface) var(--radius-xl));
  background-size: var(--radius-xl) var(--radius-xl);
  background-position:
    left bottom,
    right bottom;
  background-repeat: no-repeat;
}
@media (max-width: 900px) {
  .chat-input-bar {
    padding-inline: var(--spacing-sm);
  }
}
.transcript {
  box-sizing: border-box;
  width: min(100%, var(--size-content));
  min-width: 0;
  margin-inline: auto;
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--size-chat-input-overlay));
}
.transcript-list,
.timeline-rows,
.row {
  box-sizing: border-box;
  width: 100%;
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
</style>
