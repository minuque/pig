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
      :class="{ 'is-following': atBottom, 'is-windowed': windowed }"
      @scroll="onTranscriptScroll"
      @wheel="onTranscriptWheel"
      @pointerdown="onPointerDown"
    >
      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <button
            v-if="hasMore"
            type="button"
            class="older-busy"
            :disabled="loadingOlder"
            @click="older.request"
          >
            加载更早消息
          </button>

          <div class="timeline-rows" :style="{ minHeight: `${totalHeight}px` }">
            <template v-for="block in blocks" :key="block.key">
              <TurnRow
                v-if="block.kind === 'item'"
                :turn="block.item"
                :first="block.index === 0"
                :previous-role="turns[block.index - 1]?.rows.at(-1)?.role"
                :session-id="sessionId"
                :running="running"
                :is-expand="isExpand"
                :expanded-tools="expandedTools"
                @toggle-expand="onToggleExpand"
                @toggle-tool="onToggleTool"
              />

              <div
                v-else
                class="row-space"
                :style="{ height: `${block.height}px` }"
                aria-hidden="true"
              ></div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <SessionLoading v-if="!readyFrame" />
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
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import TurnRow from "@features/transcript-view/components/TurnRow.vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import { useTranscriptOlder } from "@features/transcript-view/hooks/use-transcript-older.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { useTranscriptWindow } from "@features/transcript-view/hooks/use-transcript-window.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { ensureMermaidRuntime } from "@features/transcript-view/lib/mermaid-runtime.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TimelineTurn, TranscriptMinimapItem } from "@features/transcript-view/type.js"
import { createTimelineRowsBuilder } from "@features/transcript-view/lib/transcript-rows.js"
import {
  groupTimelineTurns,
  reuseTimelineTurns,
} from "@features/transcript-view/lib/transcript-turns.js"
import {
  historyPrepended,
  shouldShowScrollToLatest,
} from "@features/transcript-view/lib/transcript-scroll.js"

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
  loadOlder: []
}>()
const turns = shallowRef<TimelineTurn[]>([])
const rows = computed(() => turns.value.flatMap((turn) => turn.rows))
const rowsBuilder = createTimelineRowsBuilder()

watch(
  () => ({
    sessionId: props.sessionId,
    next: rowsBuilder.build(props.transcript, props.running, props.timings),
  }),
  ({ sessionId, next }, prev) => {
    const grouped = groupTimelineTurns(next)

    if (prev && prev.sessionId !== sessionId) {
      turns.value = grouped
      return
    }

    if (grouped.length === 0 && turns.value.length > 0) return
    turns.value = reuseTimelineTurns(turns.value, grouped)
  },
  { flush: "sync", immediate: true },
)

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
  onPointerDown,
  scrollToLatest,
  scrollToElement,
} = useTranscriptFollow(scrollerRoot)
const {
  blocks,
  totalHeight,
  windowed,
  revealRow,
  scrollToRow,
  rememberAnchor,
  takeAnchor,
  hasPendingAnchor,
  applyAnchor,
  compensate,
  reset: resetWindow,
} = useTranscriptWindow({
  items: turns,
  scrollRoot: viewport,
  listRoot: list,
  isFollowing: () => atBottom.value,
})
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
} = useTranscriptMinimap(
  rows,
  { viewport, column },
  computed(() =>
    blocks.value.flatMap((block) =>
      block.kind === "item" ? block.item.rows.map((row) => row.id) : [],
    ),
  ),
)
const older = useTranscriptOlder({
  hasMore: () => props.hasMore,
  loading: () => props.loadingOlder,
  getRoot: scrollerRoot,
  isAtBottom: () => atBottom.value,
  load: () => emit("loadOlder"),
})
let anchorTimer = 0
const ANCHOR_IDLE_MS = 250

/** 停手后再记锚点：锚点只给下次切会话用，逐帧读矩形会逼出同步布局。 */
function rememberAnchorSoon() {
  if (anchorTimer) return
  anchorTimer = window.setTimeout(() => {
    anchorTimer = 0
    rememberAnchor(props.sessionId)
  }, ANCHOR_IDLE_MS)
}

function onTranscriptScroll() {
  onScroll()
  rememberAnchorSoon()
  older.onScroll()
}

function onTranscriptWheel(event: WheelEvent) {
  onWheel(event)
  older.onScroll()
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
  const el = await revealRow(item.id)

  if (el) {
    scrollToElement(el)
    return
  }

  releasePinnedToBottom()
  atBottom.value = false
  scrollToRow(item.id)
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

function pinLatest() {
  if (hasPendingAnchor()) return
  scrollToLatest("auto")
  pinIfNeeded()
}

const { readyFrame } = useTranscriptReveal(rows, pinLatest)

watch(
  () => turns.value.length,
  () => {
    if (hasPendingAnchor()) applyAnchor()
  },
  { flush: "post" },
)

watch(turns, (next, prev) => {
  const previous = prev ?? []

  if (previous.length === 0 && next.length > 0) {
    older.arm()
    return
  }

  if (historyPrepended(previous, next) && !atBottom.value && windowed.value) {
    const root = scrollerRoot()
    const beforeHeight = root?.scrollHeight ?? 0
    void nextTick(() => {
      if (!root) return
      compensate(root.scrollHeight - beforeHeight)
    })
    return
  }

  if (atBottom.value) void nextTick(pinIfNeeded)
})

watch(
  [viewport, list],
  ([, body], prev) => {
    observeSizes()

    if (body && !prev?.[1]) pinLatest()
  },
  { flush: "post" },
)

watch(
  () => props.sessionId,
  (id, prev) => {
    if (!prev || prev === id) return
    rememberAnchor(prev)
    rowsBuilder.reset()
    reset()
    resetWindow()
    older.arm()
    const stored = takeAnchor(id)

    void nextTick(() => {
      // 有锚点就按锚点复位，锚点行不在才贴底
      if (!stored || !applyAnchor()) pinLatest()
    })
  },
)

onMounted(ensureMermaidRuntime)

onBeforeUnmount(() => {
  sizeObserver?.disconnect()

  if (pinRaf) cancelAnimationFrame(pinRaf)

  if (anchorTimer) window.clearTimeout(anchorTimer)
})

defineExpose({ showScrollToLatest, scrollToLatest })
</script>

<style>
@import "markstream-vue/index.css" layer(components);
@import "../../style/markdown-stream.css";
@import "../../style/mermaid.css";
</style>

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
  overflow-y: auto;
  overscroll-behavior: contain;
  /* 主视口滚动条常显，并始终占位，内容不因溢出与否来回横移 */
  --scrollbar-thumb: var(--scrollbar-color);
  scrollbar-gutter: stable;
}

.transcript-viewport.is-windowed {
  /* 窗口化自己按行高表锚定，关掉浏览器原生滚动锚定避免两边都补 */
  overflow-anchor: none;
}

.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}

.transcript {
  box-sizing: border-box;
  width: min(100%, var(--size-content) - var(--spacing-lg));
  min-width: 0;
  margin-inline: auto;
  padding-block: var(--spacing-lg);
  padding-inline: var(--border-width);
  /* 横向裁在列内，避免视口 overflow-x 裁掉竖条；内边距留给满宽卡片边框 */
  overflow-x: clip;
}

.transcript-list,
.timeline-rows {
  box-sizing: border-box;
  width: 100%;
}

.row-space {
  box-sizing: border-box;
  width: 100%;
  pointer-events: none;
}

.older-busy {
  display: block;
  width: 100%;
  padding: var(--spacing-sm) 0;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font: inherit;
  font-size: var(--text-body-sm);
  text-align: center;
  cursor: pointer;
}

.older-busy:disabled {
  cursor: default;
}
</style>
