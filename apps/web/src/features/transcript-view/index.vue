<template>
  <div
    class="transcript-viewport"
    :style="$slots.default ? { '--chat-input-space': `${dockHeight}px` } : undefined"
  >
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
            <div v-if="isEarlierRow(row)" class="earlier-row">
              <button type="button" :disabled="loadingEarlier" @click="emit('load-earlier')">
                {{ loadingEarlier ? "加载中…" : "加载更早" }}
              </button>
            </div>
            <UserMessage v-else-if="row.role === 'user'" :item="row" />
            <AssistantMessage
              v-else-if="row.role === 'assistant'"
              :item="row"
              :streaming="isStreamingAssistant(row)"
              :timeline-markdown="markdownProps"
              @render-pending="onMarkdownPending(row.id)"
              @render-settled="onMarkdownSettled(row.id)"
            />
            <ToolCall v-else-if="row.role === 'tool'" :item="row" />
          </div>
        </template>
      </MarkstreamVirtualTimeline>

      <TranscriptMinimap
        v-if="rows.length && minimapItems.length >= MINIMAP_MIN_ITEMS"
        :items="minimapItems"
        :in-view-ids="inViewIds"
        :has-persistent-gutter="hasPersistentGutter"
        :hit-strip-width="hitStripWidth"
        @select="onMinimapSelect"
      />
    </section>

    <div v-if="$slots.default" ref="dock" class="chat-input-dock">
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
      <slot />
    </div>
  </div>
</template>

<script lang="ts">
import type { TranscriptItem } from "@earendil-works/pi-protocol"
import type { MarkstreamThreadVirtualState } from "markstream-vue"
import {
  assistantThinking,
  conversationRows,
  isAssistantItem,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"

export const EARLIER_ROW_ID = "transcript-earlier"

export type EarlierRow = { id: typeof EARLIER_ROW_ID; role: "earlier" }
export type TimelineRow = TranscriptItem | EarlierRow

export function isEarlierRow(row: TimelineRow): row is EarlierRow {
  return row.role === "earlier"
}

/** 有更早消息时插在时间线头顶，占独立一行，随列表滚动。 */
export function withEarlierRow(
  items: readonly TranscriptItem[],
  hasEarlier: boolean,
): TimelineRow[] {
  const rows = conversationRows(items)
  if (!hasEarlier) return rows
  return [{ id: EARLIER_ROW_ID, role: "earlier" }, ...rows]
}

/** 打开会话只恢复行高缓存，视口强制贴底。 */
export function threadStatePinnedToBottom(
  state: MarkstreamThreadVirtualState | null,
): MarkstreamThreadVirtualState | null {
  if (!state) return null
  return {
    ...state,
    outerAnchor: { type: "bottom", distanceFromBottomPx: 0 },
  }
}

/** 时间线认 Markdown 的 kind：仅助手正文。加载行不是 Markdown。 */
export function transcriptRowKind(item: TimelineRow): string {
  if (isEarlierRow(item)) return "load-earlier"
  if (item.role === "assistant") return "assistant-markdown"
  if (item.role === "tool") return "tool-call"
  return "user-message"
}

export function transcriptRowContent(item: TimelineRow): string {
  return !isEarlierRow(item) && isAssistantItem(item) ? transcriptText(item) : ""
}

export function transcriptRowFinal(item: TimelineRow): boolean {
  return isEarlierRow(item) || !(isAssistantItem(item) && item.status === "streaming")
}

/** 与 Markstream 新增行的精确贴底阈值一致，避免 UI 和时间线各判一套状态。 */
export function isTranscriptAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 2,
): boolean {
  return scrollHeight - scrollTop - clientHeight <= threshold
}

/** 与 Markstream te（48px）一致：上翻解锁的 3px / DPI 余量仍算在底部，不弹出按钮。 */
export function isTranscriptVisuallyAtBottom(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
): boolean {
  return isTranscriptAtBottom(scrollHeight, scrollTop, clientHeight, 48)
}

/** 有内容且视觉上离开底部才显示回到底部按钮。 */
export function shouldShowScrollToLatest(transcriptLength: number, atBottom: boolean): boolean {
  return transcriptLength > 0 && !atBottom
}

/** ponytail: 2s 封顶，markdown-stream 卡住时不挡会话 */
export const MARKDOWN_STREAM_READY_TIMEOUT_MS = 2000

/** 无助手正文即可撤；有则必须已挂上且 pending 清零。 */
export function isMarkdownStreamReady(
  hasMarkdownRows: boolean,
  pendingCount: number,
  mounted: boolean,
): boolean {
  if (pendingCount > 0) return false
  if (!hasMarkdownRows) return true
  return mounted
}

/** 盖过时间线已排队的旧锚点 rAF 与测高回写。 */
export const PROGRAMMATIC_BOTTOM_HOLD_MS = 400

/** 程序化滚底后，未贴底读数在 hold 窗口内视为旧锚点回写。 */
export function shouldHoldProgrammaticBottom(
  measuredBottom: boolean,
  holdUntil: number,
  now: number,
): boolean {
  return !measuredBottom && now < holdUntil
}

/** 贴底后明显上翻才解锁。1px 级惯性不能 preventDefault，否则永远触不了底。 */
export function unpinBottomScrollTop(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  deltaY: number,
  threshold = 2,
): number | null {
  if (deltaY >= 0 || Math.abs(deltaY) <= threshold) return null
  if (!isTranscriptAtBottom(scrollHeight, scrollTop, clientHeight, threshold)) return null
  const maxTop = Math.max(0, scrollHeight - clientHeight)
  return Math.max(0, Math.min(maxTop, scrollTop - Math.abs(deltaY)))
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1
  let lines = 0
  for (const part of text.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine))
  }
  return lines
}

/**
 * 虚拟列表估高：宁可偏高，避免宽度变窄后按 200px 塞进过多未测行。
 * 助手约 48 字/行、26px 行高；用户约 36 字/行、22px 行高。
 */
export function estimateTranscriptRowHeight(item: TimelineRow): number {
  if (isEarlierRow(item) || item.role === "tool") return 48
  const text = transcriptText(item)
  if (item.role === "user") {
    return Math.min(280, 56 + estimateWrappedLines(text, 36) * 22)
  }
  const height = 36 + estimateWrappedLines(text, 48) * 26
  const thinking = isAssistantItem(item) && assistantThinking(item).length > 0 ? 36 : 0
  return Math.min(960, Math.max(160, height + thinking))
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import { ArrowDown } from "lucide-vue-next"
import { MarkstreamVirtualTimeline } from "markstream-vue"
import type { SessionPhase } from "@earendil-works/pi-protocol"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import { Button } from "@components/ui/button/index.js"
import {
  deriveTranscriptMinimapItems,
  MINIMAP_MIN_ITEMS,
  resolveMinimapHasPersistentGutter,
  resolveMinimapHitStripWidth,
  sameIdList,
  type TranscriptMinimapItem,
} from "@features/transcript-view/lib/transcript-minimap.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const props = withDefaults(
  defineProps<{
    sessionId: string
    /** 官方 TranscriptItem 列表：RemoteSession 维护的投影 */
    transcript: readonly TranscriptItem[]
    /** 当前 Session phase：非 idle 时显示 streaming 空态 */
    phase: SessionPhase | undefined
    /** 上次离开该会话时的虚拟滚动状态：只复用行高，打开时贴底 */
    threadState: MarkstreamThreadVirtualState | null
    hasEarlier?: boolean
    loadingEarlier?: boolean
  }>(),
  { hasEarlier: false, loadingEarlier: false },
)

const emit = defineEmits<{
  "thread-state": [state: MarkstreamThreadVirtualState]
  "load-earlier": []
  ready: []
}>()

defineSlots<{ default?: () => unknown }>()

const running = computed(() => props.phase !== undefined && props.phase !== "idle")
const rows = computed(() => withEarlierRow(props.transcript, props.hasEarlier))
const pinnedThreadState = computed(() => threadStatePinnedToBottom(props.threadState))
const transcriptTitleId = computed(() => `transcript-title-${props.sessionId}`)
const region = useTemplateRef<HTMLElement>("region")
const dock = useTemplateRef<HTMLElement>("dock")
const dockHeight = shallowRef(168)
const { isDark } = useColorScheme()
const measurementKey = computed(() => (isDark.value ? "dark" : "light"))
const minimapItems = computed(() =>
  deriveTranscriptMinimapItems(
    rows.value.map((row) => ({
      id: row.id,
      role: row.role,
      text: isEarlierRow(row) ? "" : transcriptText(row),
    })),
  ),
)
const viewportWidth = shallowRef(0)
const inViewIds = shallowRef<readonly string[]>([])
const hasPersistentGutter = computed(() => resolveMinimapHasPersistentGutter(viewportWidth.value))
const hitStripWidth = computed(() => resolveMinimapHitStripWidth(viewportWidth.value))

// 虚拟滚动行 key：以 TranscriptItem id 保证流式输出时同一行原地更新
function rowKey(item: TimelineRow): string {
  return item.id
}

function isStreamingAssistant(item: TranscriptItem): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false
  return isAssistantItem(item) && item.status === "streaming"
}

const pendingMarkdownIds = new Set<string>()
let markdownMounted = false
let streamReadyEmitted = false
let readyTimer = 0

function hasMarkdownRows(): boolean {
  return rows.value.some(
    (row) => !isEarlierRow(row) && row.role === "assistant" && Boolean(transcriptText(row)),
  )
}

function emitStreamReady() {
  if (streamReadyEmitted) return
  streamReadyEmitted = true
  if (readyTimer) {
    clearTimeout(readyTimer)
    readyTimer = 0
  }
  emit("ready")
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

/* ── 贴底跟随与「跳转到最新」：滚动状态由 MarkstreamVirtualTimeline 管理 ── */
const timeline = useTemplateRef<{
  scrollToBottom(): void
  scrollToIndex(index: number, align?: "start" | "center" | "end"): void
  captureThreadState(): MarkstreamThreadVirtualState
  restoreThreadState(state: MarkstreamThreadVirtualState): void
}>("timeline")
// 新增行只在精确贴底时自动跟随。
const atBottom = shallowRef(true)
const showScrollToLatest = computed(() =>
  shouldShowScrollToLatest(props.transcript.length, atBottom.value),
)
let bottomHoldUntil = 0
let pinRaf = 0
let dockObserver: ResizeObserver | undefined

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
  if (nextTop === null) return
  event.preventDefault()
  root.scrollTop = nextTop
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

function collectInViewIds(): string[] {
  const root = region.value
  if (!root) return []
  const viewport = root.getBoundingClientRect()
  const ids: string[] = []
  for (const el of root.querySelectorAll<HTMLElement>("[data-minimap-row]")) {
    const box = el.getBoundingClientRect()
    if (box.bottom <= viewport.top || box.top >= viewport.bottom) continue
    const id = el.dataset.minimapRow
    if (id) ids.push(id)
  }
  return ids
}

function syncInViewIds() {
  const next = collectInViewIds()
  if (!sameIdList(inViewIds.value, next)) inViewIds.value = next
}

function onThreadState(state: MarkstreamThreadVirtualState) {
  syncInViewIds()
  const root = timelineScrollRoot()
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

function onMinimapSelect(item: TranscriptMinimapItem) {
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

// flush:pre 确保子时间线收到新 thread-key 前捕获旧 Session。
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
// 打开或切换会话：内容就绪后贴底。从空到有行也滚一次（首屏迟到）。
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

let viewportObserver: ResizeObserver | undefined
watch(
  region,
  (el) => {
    viewportObserver?.disconnect()
    if (!el) return
    const measure = () => {
      viewportWidth.value = el.getBoundingClientRect().width
      syncInViewIds()
    }
    viewportObserver = new ResizeObserver(measure)
    viewportObserver.observe(el)
    measure()
  },
  { flush: "post" },
)
watch(
  dock,
  (element) => {
    dockObserver?.disconnect()
    if (!element) return
    dockObserver = new ResizeObserver(() => {
      const nextHeight = element.offsetHeight
      const grew = nextHeight > dockHeight.value
      dockHeight.value = nextHeight
      if (grew && atBottom.value) scrollToLatest()
    })
    dockObserver.observe(element)
    dockHeight.value = element.offsetHeight
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  viewportObserver?.disconnect()
  dockObserver?.disconnect()
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
  height: 100%;
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
  background: transparent;
}
/* 菜单在 transcript 内，抬整列才能压过绝对定位的 dock。区域背景透明，输入卡仍看得见。 */
.transcript-region:has(.code-more-menu) {
  z-index: 3;
}
.chat-input-dock {
  position: absolute;
  inset-inline: 0 8px;
  bottom: 0;
  z-index: 2;
  padding: 0 var(--spacing-md) 10px;
  background: var(--surface);
  pointer-events: none;
}
.session-floating-controls {
  /* 脱离 Dock 测量流，避免显隐时改写 transcript 底部 inset 并触发滚动回弹。 */
  position: absolute;
  inset-inline: var(--spacing-md);
  bottom: calc(100% + var(--spacing-xxs));
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
.chat-input-dock :deep(.prompt) {
  pointer-events: auto;
  width: min(var(--size-composer), 100%);
  margin-inline: auto;
}
@media (max-width: 900px) {
  .chat-input-dock {
    padding-inline: var(--spacing-sm);
  }
  .session-floating-controls {
    inset-inline: var(--spacing-sm);
  }
}
/* 滚动根自带 overflow:auto；首尾 inset 写在容器上，不进虚拟行高 */
.transcript {
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--chat-input-space, 168px) + var(--spacing-md));
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: var(--hairline) transparent;
}
.transcript::-webkit-scrollbar {
  width: 8px;
}
.transcript::-webkit-scrollbar-track {
  background: transparent;
}
.transcript::-webkit-scrollbar-thumb {
  background: var(--hairline);
  border-radius: var(--radius-full);
}
.transcript::-webkit-scrollbar-thumb:hover {
  background: var(--ink-muted);
}
/* 内容宽度约束：由每个虚拟行继承，替代原 transcript-content 的宽度盒 */
.transcript :deep(.markstream-virtual-timeline__item) {
  width: min(var(--size-content), 100%);
  margin-inline: auto;
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
.earlier-row {
  display: flex;
  justify-content: center;
  padding: var(--spacing-sm) 0 var(--spacing-md);
}
.earlier-row button {
  min-height: var(--size-nav-action);
  padding: 4px 12px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}
.earlier-row button:hover:not(:disabled) {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.earlier-row button:disabled {
  cursor: default;
  opacity: 0.7;
}
.shimmer {
  color: var(--ink-muted);
}
</style>
