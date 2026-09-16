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
          <button
            v-if="hasMore"
            type="button"
            class="older-busy"
            :disabled="loadingOlder"
            @click="requestOlder"
          >
            加载更早消息
          </button>

          <div class="timeline-rows">
            <div
              v-for="row in rows"
              :key="row.id"
              class="row"
              :class="`row-${row.role}`"
              :data-minimap-row="row.role === 'user' ? row.id : undefined"
              :data-hydrate-id="row.role === 'assistant' ? row.id : undefined"
            >
              <UserMessage v-if="row.role === 'user'" :item="row" />

              <AssistantMessage
                v-else-if="row.role === 'assistant'"
                :item="row"
                :streaming="running && row.streaming"
                :hydrated="isHydrated(row.id)"
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
  onActivated,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue"
import { enableMermaid } from "markstream-vue"
import AssistantMessage from "@features/transcript-view/components/AssistantMessage.vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import UserMessage from "@features/transcript-view/components/UserMessage.vue"
import ToolSteps from "@features/transcript-view/components/ToolSteps.vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptHydrate } from "@features/transcript-view/hooks/use-transcript-hydrate.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { useTranscriptScrollIdle } from "@features/transcript-view/hooks/use-transcript-scroll-idle.js"
import type { TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TimelineRow, TranscriptMinimapItem } from "@features/transcript-view/type.js"
import {
  buildTimelineRows,
  isToolRow,
  reuseTimelineRows,
  timelineRowKeys,
} from "@features/transcript-view/lib/transcript-rows.js"
import {
  restoreScrollAfterPrepend,
  shouldLoadOlderTranscript,
  shouldShowScrollToLatest,
  transcriptOverflows,
} from "@features/transcript-view/lib/transcript-scroll.js"

let markdownRuntimeStarted = false

const FILL_HEX = /(?:^|;)\s*fill:\s*(#[0-9a-fA-F]{3,8})/i

const LABEL_COLOR = /(?:^|;)\s*color\s*:/i

function fillLuminance(hex: string): number {
  let h = hex.slice(1)

  if (h.length === 3) h = [...h].map((c) => c + c).join("")
  const n = Number.parseInt(h.slice(0, 6), 16)

  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

/** 自定义深色 fill 且未写 color 时，标签改白字。 */
function paintCustomNodeLabels(svg: string): string {
  const wrap = document.createElement("div")
  wrap.innerHTML = svg

  for (const node of wrap.querySelectorAll(".node")) {
    const shape = node.querySelector(
      ":scope > rect, :scope > polygon, :scope > path, :scope > circle",
    )

    const label = node.querySelector(".nodeLabel")

    if (!shape || !label) continue
    const labelStyle = label.getAttribute("style") ?? ""

    if (LABEL_COLOR.test(labelStyle)) continue
    const fill = FILL_HEX.exec(shape.getAttribute("style") ?? "")?.[1]

    if (!fill || fillLuminance(fill) >= 0.45) continue
    const sep = labelStyle && !labelStyle.endsWith(";") ? ";" : ""
    label.setAttribute("style", `${labelStyle}${sep}color:#ffffff`)
  }

  return wrap.innerHTML
}

async function loadMermaid(): Promise<unknown> {
  const mermaid = (await import("mermaid")).default
  const render = mermaid.render.bind(mermaid)
  mermaid.render = (async (...args: Parameters<typeof mermaid.render>) => {
    const result = await render(...args)
    return result.svg ? { ...result, svg: paintCustomNodeLabels(result.svg) } : result
  }) as typeof mermaid.render
  return mermaid
}

/** 第一次进 Transcript 再加载 mermaid，解析走主线程，不打 3MB worker。 */
function ensureMarkdownRuntime(): void {
  if (markdownRuntimeStarted) return
  markdownRuntimeStarted = true
  enableMermaid(loadMermaid)
}

/** 更长列表的前缀是新历史，prev 仍作为后缀出现。 */
function historyPrepended(
  prev: readonly { readonly id: string }[],
  next: readonly { readonly id: string }[],
): boolean {
  if (prev.length === 0 || next.length <= prev.length) return false
  const offset = next.length - prev.length

  for (let i = 0; i < prev.length; i += 1) {
    if (next[offset + i]?.id !== prev[i]?.id) return false
  }

  return true
}

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

const rows = shallowRef<TimelineRow[]>([])

const mountedKeys = computed(() => timelineRowKeys(rows.value))

watch(
  () => buildTimelineRows(props.transcript, props.running, props.timings),
  (next) => {
    if (next.length === 0 && rows.value.length > 0) return
    rows.value = reuseTimelineRows(rows.value, next)
  },
  { flush: "sync", immediate: true },
)

const { expandedTools, isExpand, toggleExpand, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)

const viewport = useTemplateRef<HTMLElement>("viewport")

const column = useTemplateRef<HTMLElement>("column")

const list = useTemplateRef<HTMLElement>("list")

const scrollIdle = useTranscriptScrollIdle(viewport)

function scrollerRoot(): HTMLElement | null {
  return viewport.value
}

const {
  atBottom,
  visuallyAtBottom,
  pinIfNeeded,
  releasePinnedToBottom,
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

const LOAD_OLDER_TOP = 48

let loadOlderArmed = true

function requestOlder() {
  if (!props.hasMore || props.loadingOlder) return
  loadOlderArmed = false
  emit("loadOlder")
}

function maybeLoadOlder() {
  const root = scrollerRoot()
  const top = root?.scrollTop ?? 0

  if (top > LOAD_OLDER_TOP) loadOlderArmed = true

  if (!loadOlderArmed) return
  const overflow = transcriptOverflows(root?.scrollHeight ?? 0, root?.clientHeight ?? 0)

  if (
    !shouldLoadOlderTranscript(props.hasMore, props.loadingOlder, atBottom.value, top, {
      threshold: LOAD_OLDER_TOP,
      overflow,
    })
  )
    return
  requestOlder()
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

function pinLatest() {
  scrollToLatest("auto")
  pinIfNeeded()
}

const { readyFrame } = useTranscriptReveal(rows, pinLatest)

const { isHydrated, observe } = useTranscriptHydrate(rows, scrollIdle, scrollerRoot, readyFrame)

function armTailWindow() {
  loadOlderArmed = true
}

watch(rows, (next, prev) => {
  const previous = prev ?? []

  if (previous.length === 0 && next.length > 0) {
    armTailWindow()
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
    observe()

    if (body && !prev?.[1]) pinLatest()
  },
  { flush: "post" },
)

onMounted(ensureMarkdownRuntime)

onActivated(() => {
  observe()
})

onBeforeUnmount(() => {
  sizeObserver?.disconnect()

  if (pinRaf) cancelAnimationFrame(pinRaf)
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
  overflow-x: hidden;
  overflow-y: auto;
  overflow-anchor: auto;
  overscroll-behavior: contain;
  /* 主视口滚动条常显，并始终占位，内容不因溢出与否来回横移 */
  --scrollbar-thumb: var(--scrollbar-color);
  scrollbar-gutter: stable;
}

.transcript-viewport.is-following {
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
}

.transcript-list,
.timeline-rows {
  box-sizing: border-box;
  width: 100%;
}

.row {
  box-sizing: border-box;
  width: 100%;
  content-visibility: auto;
  contain-intrinsic-block-size: auto calc(var(--spacing-lg) * 3);
}

.row-user {
  content-visibility: visible;
  contain-intrinsic-block-size: auto calc(var(--spacing-lg) * 2);
}

.row-assistant {
  contain-intrinsic-block-size: auto calc(var(--spacing-lg) * 6);
}

.row-tool {
  contain-intrinsic-block-size: auto calc(var(--spacing-lg) * 2);
}

.row-tools {
  content-visibility: visible;
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
