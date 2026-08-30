<template>
  <div ref="viewport" class="transcript-viewport">
    <section
      id="transcript-panel"
      ref="region"
      class="transcript-region"
      @wheel="onWheel"
      @pointerdown="releasePinnedToBottom"
    >
      <div v-if="rows.length" ref="scroller" class="transcript" @scroll="onTranscriptScroll">
        <div ref="list" class="transcript-list">
          <div
            v-for="row in rows"
            :key="row.id"
            class="row"
            :data-minimap-row="row.role === 'user' ? row.id : undefined"
          >
            <UserMessage v-if="row.role === 'user'" :item="row" />
            <AssistantMessage
              v-else-if="row.role === 'assistant'"
              :item="row"
              :streaming="running && row.streaming"
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
        </div>
      </div>
      <TranscriptMinimap
        v-if="rows.length && minimapItems.length >= MINIMAP_MIN_ITEMS"
        :items="minimapItems"
        :in-view-ids="inViewIds"
        :hit-strip-width="hitStripWidth"
        @select="selectMinimapItem"
      />
    </section>

    <div ref="inputBar" class="chat-input-bar">
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

    <div class="session-floating-controls" :class="{ shown: showScrollToLatest }">
      <Button
        class="scroll-latest-control"
        type="button"
        variant="outline"
        size="icon-sm"
        title="滚动到底部"
        @click="scrollToLatest"
      >
        <ArrowDown />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, useTemplateRef, watch } from "vue"
import { ArrowDown } from "lucide-vue-next"
import ChatInput from "@features/chat-input/index.vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ThinkingState from "@features/transcript-view/components/ThinkingState.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import WorkRow from "@features/transcript-view/components/WorkRow.vue"
import { Button } from "@components/ui/button/index.js"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import {
  MINIMAP_MIN_ITEMS,
  type TranscriptMinimapItem,
} from "@features/transcript-view/lib/transcript-minimap.js"
import type { TranscriptItem } from "@features/transcript-view/lib/transcript-format.js"
import {
  buildTimelineRows,
  isThinkingRow,
  isWorkRow,
} from "@features/transcript-view/lib/transcript-rows.js"
import { shouldShowScrollToLatest } from "@features/transcript-view/lib/transcript-scroll.js"
import { useSession } from "@features/session-workbench/index.js"

const props = defineProps<{
  sessionId: string
  transcript: readonly TranscriptItem[]
  running: boolean
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
const rows = computed(() => buildTimelineRows(props.transcript, props.running))
const { expandedTools, isFoldOpen, toggleFold, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)
const viewport = useTemplateRef<HTMLElement>("viewport")
const region = useTemplateRef<HTMLElement>("region")
const inputBar = useTemplateRef<HTMLElement>("inputBar")
const scroller = useTemplateRef<HTMLElement>("scroller")
const list = useTemplateRef<HTMLElement>("list")

function scrollerRoot(): HTMLElement | null {
  return scroller.value
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
  region,
  viewport,
  inputBar,
  scrollRoot: scrollerRoot,
})

function onTranscriptScroll() {
  syncLayout(region.value, scrollerRoot())
  onScroll()
}

function selectMinimapItem(item: TranscriptMinimapItem) {
  const root = scrollerRoot()
  const target = root?.querySelector<HTMLElement>(`[data-minimap-row="${CSS.escape(item.id)}"]`)
  if (target) scrollToElement(target)
}

function submitFromInput(text: string) {
  scrollToLatest()
  return submitText(text)
}

function observeSizes() {
  sizeObserver?.disconnect()
  sizeObserver = undefined
  const root = scroller.value
  const body = list.value
  if (!root && !body) return
  sizeObserver = new ResizeObserver(() => {
    syncLayout(region.value, scrollerRoot())
    pinIfNeeded()
  })
  if (root) sizeObserver.observe(root)
  if (body) sizeObserver.observe(body)
}

watch(() => props.sessionId, reset, { flush: "pre" })
watch(rows, (next, prev) => {
  if (prev.length === 0 && next.length > 0) scrollToLatest()
  else if (atBottom.value) void nextTick(pinIfNeeded)
})
watch([scroller, list], observeSizes, { flush: "post" })

onBeforeUnmount(() => sizeObserver?.disconnect())
</script>

<style scoped>
.transcript-viewport {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  --chat-input-overlay: 6rem;
}
@media (prefers-reduced-motion: reduce) {
  .session-floating-controls {
    transition: none;
  }
}
.transcript-region {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
}
.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}
.session-floating-controls {
  position: absolute;
  inset-inline: var(--spacing-md);
  bottom: calc(var(--chat-input-overlay) + var(--spacing-sm));
  z-index: 3;
  max-width: var(--size-chat-input);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}
.session-floating-controls.shown {
  opacity: 1;
}
.session-floating-controls.shown .scroll-latest-control {
  pointer-events: auto;
}
.scroll-latest-control {
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
  color: var(--ink-secondary);
  box-shadow: var(--shadow-float);
}
.chat-input-bar {
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  z-index: 2;
  padding: 0 var(--spacing-md) 10px;
  background: var(--surface);
  pointer-events: none;
}
.chat-input-bar :deep(.prompt) {
  pointer-events: auto;
}
@media (max-width: 900px) {
  .session-floating-controls {
    inset-inline: var(--spacing-sm);
  }
  .chat-input-bar {
    padding-inline: var(--spacing-sm);
  }
}
.transcript {
  box-sizing: border-box;
  flex: none;
  align-self: stretch;
  width: min(100%, var(--size-content));
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--spacing-lg) + var(--chat-input-overlay));
  overscroll-behavior: contain;
  --scrollbar-thumb: #0000;
  scrollbar-width: none;
}
.transcript::-webkit-scrollbar {
  display: none;
}
.transcript-list,
.row {
  box-sizing: border-box;
  width: 100%;
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
