<template>
  <div class="transcript-shell">
    <TranscriptMinimap
      v-if="rows.length && minimapItems.length >= MINIMAP_MIN_ITEMS"
      :items="minimapItems"
      :in-view-ids="inViewIds"
      :current-id="minimapCurrentId"
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
      @pointerdown="onPointerDown"
    >
      <div class="transcript-edge-top edge-veil-top" aria-hidden="true"></div>

      <div v-if="rows.length || running" ref="column" class="transcript">
        <div ref="list" class="transcript-list">
          <div v-if="hasMore" class="older-control">
            <Button
              class="older-button press-scale"
              type="button"
              variant="soft"
              size="s"
              radius="full"
              :disabled="loadingOlder"
              @click="older.request"
            >
              <span class="icon-swap">
                <LoaderIcon :data-visible="loadingOlder" :class="{ 'is-spinning': loadingOlder }" />
                <ArrowUpIcon :data-visible="!loadingOlder" />
              </span>

              {{ t("transcript.loadEarlier") }}
            </Button>
          </div>

          <div class="timeline-rows">
            <template v-for="(turn, turnIndex) in turns" :key="turn.id">
              <TurnRow
                :turn="turn"
                :class="{ 'turn-runway': turn.id === runwayId }"
                :session-id="sessionId"
                :running="running"
                :is-expand="isExpand"
                :expanded-tools="expandedTools"
                @toggle-expand="onToggleExpand"
                @toggle-tool="onToggleTool"
              >
                <!-- 指示器挂在本轮里：跑道留白落在它之后，贴底时指示器跟着用户消息留在顶部 -->
                <TranscriptStatus v-if="turnIndex === turns.length - 1" v-bind="statusProps" />
              </TurnRow>
            </template>
          </div>

          <!-- 还没有轮时（发送中）指示器没有归属的轮，单独挂一份 -->
          <TranscriptStatus v-if="turns.length === 0" v-bind="statusProps" />
        </div>
      </div>
    </div>

    <SessionLoading v-if="!readyFrame" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import TranscriptStatus from "@features/transcript-view/components/TranscriptStatus.vue"
import TurnRow from "@features/transcript-view/components/TurnRow.vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import {
  useTranscriptOlder,
  useTranscriptReveal,
} from "@features/transcript-view/hooks/use-transcript-edge.js"
import type { SessionPhase, TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/turn-type.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TimelineTurn, TranscriptMinimapItem } from "@features/transcript-view/type.js"
import { createTimelineRowsBuilder } from "@features/transcript-view/lib/transcript-rows.js"
import { turnOutputTokens } from "@features/transcript-view/lib/transcript-activity.js"
import {
  groupTimelineTurns,
  reuseTimelineTurns,
} from "@features/transcript-view/lib/transcript-turns.js"
import {
  historyPrepended,
  shouldShowScrollToLatest,
} from "@features/transcript-view/lib/transcript-scroll.js"
import { ArrowUpIcon, LoaderIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    sessionId: string
    transcript: readonly TranscriptItem[]
    running: boolean
    phase?: SessionPhase | undefined
    sending?: boolean
    stopping?: boolean
    timings?: readonly TurnTiming[] | undefined
    hasMore?: boolean
    loadingOlder?: boolean
  }>(),
  { hasMore: false, loadingOlder: false, sending: false, stopping: false },
)
const emit = defineEmits<{
  loadOlder: []
}>()
const { t } = useI18n()
const turns = shallowRef<TimelineTurn[]>([])
const rows = computed(() => turns.value.flatMap((turn) => turn.rows))
const rowsBuilder = createTimelineRowsBuilder()
/** 运行中轮的起点：turn.id 就是 user 条目 id，timing.userId 与之对应。 */
const activeStartedAt = computed(() => {
  if (!props.running) return undefined
  const lastId = turns.value.at(-1)?.id
  const timing = props.timings?.find(
    (value) => value.userId === lastId && value.outcome === "running",
  )
  return timing?.startedAt
})
/** 当前轮的 output token 汇总；orphan 轮回退到行内最后一条 user。 */
const activeOutputTokens = computed(() => {
  const turn = turns.value.at(-1)

  if (!turn) return null

  const userId = turn.id.startsWith("orphan:")
    ? turn.rows.find((row) => row.role === "user")?.id
    : turn.id
  return turnOutputTokens(props.transcript, userId)
})

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

/** 指示器有两个挂载点（末轮内 / 无轮时独立），props 走一份。 */
const statusProps = computed(() => ({
  phase: props.phase,
  sending: props.sending,
  stopping: props.stopping,
  startedAt: activeStartedAt.value,
  rows: rows.value,
  outputTokens: activeOutputTokens.value,
}))
const { expandedTools, isExpand, toggleExpand, toggleTool } = useTranscriptExpand(
  () => props.sessionId,
)
const viewport = useTemplateRef("viewport")
const column = useTemplateRef("column")
const list = useTemplateRef("list")

function scrollerRoot(): HTMLElement | null {
  return viewport.value
}

const {
  atBottom,
  visuallyAtBottom,
  pinIfNeeded,
  observeGrowth,
  observePadding,
  detachFollow,
  reset,
  onScroll,
  onWheel,
  onPointerDown,
  scrollToLatest,
  scrollToElement,
} = useTranscriptFollow(scrollerRoot)
/** 切走的会话记住滚动位置，切回来先复位；没有记录才贴底。 */
const scrollMemory = new Map<string, number>()
let pendingRestore: number | undefined
let historyPending = 0
const showScrollToLatest = computed(() =>
  shouldShowScrollToLatest(props.transcript.length, visuallyAtBottom.value),
)
let sizeObserver: ResizeObserver | undefined
let stopWatchers: (() => void)[] = []
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
  currentId: minimapCurrentId,
  hitStripWidth,
} = useTranscriptMinimap(
  rows,
  { viewport, column },
  computed(() => rows.value.map((row) => row.id)),
)
const older = useTranscriptOlder({
  hasMore: () => props.hasMore,
  loading: () => props.loadingOlder,
  load: () => emit("loadOlder"),
})

function onTranscriptScroll() {
  onScroll()
}

function onTranscriptWheel(event: WheelEvent) {
  onWheel(event)
}

function onToggleExpand(id: string, open: boolean) {
  detachFollow()
  atBottom.value = false
  toggleExpand(id, open)
}

function onToggleTool(rowId: string, id: string, open: boolean) {
  detachFollow()
  atBottom.value = false

  if (open) toggleExpand(rowId, true)
  toggleTool(id, open)
}

function selectMinimapItem(item: TranscriptMinimapItem) {
  const el = column.value?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(item.id)}"]`)

  if (!el) return
  detachFollow()
  atBottom.value = false
  scrollToElement(el)
}

function observeSizes() {
  sizeObserver?.disconnect()
  sizeObserver = undefined

  for (const stop of stopWatchers) stop()
  stopWatchers = []
  const root = viewport.value
  const body = list.value
  const padded = column.value

  if (!root && !body && !padded) return
  sizeObserver = new ResizeObserver(schedulePin)

  if (root) sizeObserver.observe(root)

  if (body) {
    sizeObserver.observe(body)
    stopWatchers.push(observeGrowth(body))
  }

  if (!padded || padded === body) return
  stopWatchers.push(observePadding(padded))
}

function pinLatest() {
  scrollToLatest("auto")
  pinIfNeeded()
}

function scrollToElementOffset(top: number) {
  const root = scrollerRoot()

  if (root) root.scrollTop = top
}

const { readyFrame } = useTranscriptReveal(rows, pinLatest)
/** 刚发送的一轮：预留一屏高度，把新消息滚到视口顶部。 */
const runwayId = shallowRef<string>()

function userTurnAppended(previous: readonly TimelineTurn[], next: readonly TimelineTurn[]) {
  return (
    previous.length > 0 &&
    next.length === previous.length + 1 &&
    next.at(-2)?.id === previous.at(-1)?.id &&
    next.at(-1)?.rows[0]?.role === "user"
  )
}

watch(turns, (next, prev) => {
  const previous = prev ?? []

  /* 位置恢复等这一轮内容真正挂上再写，数据还没到时写 scrollTop 会被重置。 */
  if (pendingRestore !== undefined && next.length > 0) {
    const target = pendingRestore
    pendingRestore = undefined
    void nextTick(() => scrollToElementOffset(target))
  }

  if (previous.length === 0 && next.length > 0) return

  if (userTurnAppended(previous, next)) {
    runwayId.value = next.at(-1)?.id

    if (atBottom.value) void nextTick(() => scrollToLatest("smooth"))
    return
  }

  if (historyPrepended(previous, next) && !atBottom.value) {
    const root = scrollerRoot()
    const beforeHeight = root?.scrollHeight ?? 0

    historyPending += 1
    void nextTick(() => {
      if (!root) return
      const delta = root.scrollHeight - beforeHeight

      if (historyPending > 0 && delta > 0) root.scrollTop += delta
      historyPending -= 1
    })
    return
  }

  if (atBottom.value) void nextTick(pinIfNeeded)
})

watch(
  [viewport, list, column],
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

    const root = scrollerRoot()

    if (root) scrollMemory.set(prev, root.scrollTop)
    runwayId.value = undefined
    rowsBuilder.reset()
    reset()
    pendingRestore = scrollMemory.get(id)

    if (pendingRestore === undefined) {
      void nextTick(pinLatest)
      return
    }

    // 行已就位时 turns 不会再变，这里补一次；还没到就交给 turns 的兜底分支
    const target = pendingRestore

    void nextTick(() => {
      if (pendingRestore !== target || turns.value.length === 0) return
      pendingRestore = undefined
      scrollToElementOffset(target)
    })
  },
)

onBeforeUnmount(() => {
  sizeObserver?.disconnect()

  for (const stop of stopWatchers) stop()

  if (pinRaf) cancelAnimationFrame(pinRaf)
})

defineExpose({ showScrollToLatest, scrollToLatest })
</script>

<style scoped>
.transcript-shell {
  position: relative;
  /* 内部 z-index 关进独立 stacking context，stage 层伪元素蒙层才能盖住 */
  isolation: isolate;
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
  /* 补历史时按高度差手动补 scrollTop，浏览器锚定会再补一次 */
  overflow-anchor: none;
  scroll-padding-bottom: var(--composer-reserve, 0px);
  /* 给 .turn-runway 的 cqh 提供视口高度 */
  container-type: size;
  /* 滚动条常显两侧各一槽：内容相对列居中，不因溢出与否左右横移 */
  --scrollbar-thumb: var(--scrollbar-color);
  scrollbar-gutter: stable both-edges;
}

/* 顶部渐隐层压住普通行，工具行由 .row-tools 的 z-index 抬到它上面 */
.transcript-edge-top {
  /* 与正文同底：main 的卡面色，不是抬升过的 --workbench-surface */
  background: linear-gradient(to bottom, var(--card), transparent);
}

/* 最后一轮至少撑满可见区：贴底时这轮的用户消息落在顶部渐隐带下方，指示器跟在消息后。
   跑道扣掉正文上下留白和渐隐带，消息才不会顶到视口上沿被盖住。 */
.turn-runway {
  min-height: calc(
    100cqh - var(--transcript-pad-block) - var(--edge-fade-band) - var(--composer-reserve, 0px)
  );
}

.transcript-viewport:has(.code-more-menu) {
  z-index: 3;
}

.transcript {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  padding-top: var(--transcript-pad-block);
  /* 底部留白：正文留白 + 输入条占位 */
  padding-bottom: calc(var(--transcript-pad-block) + var(--composer-reserve, 0px));
  padding-inline: max(var(--transcript-gutter), calc((100% - var(--size-content)) / 2));
  /* 横向裁在列内，避免视口 overflow-x 裁掉竖条；内边距留给满宽卡片边框 */
  overflow-x: clip;
}

@media (max-width: 780px) {
  .transcript {
    padding-inline: var(--transcript-gutter-narrow);
  }
}

.transcript-list,
.timeline-rows {
  box-sizing: border-box;
  width: 100%;
}

/* 胶囊钮的水平居中由外层撑满列宽；上下留白与正文其它块同档 */
.older-control {
  display: flex;
  justify-content: center;
  padding-block: var(--space-sm);
}

/* soft 强调色是基础件给的；这里只把高度、字级与图标补到胶囊档 */
.older-button {
  height: var(--size-scroll-control);
  padding-inline: var(--space-sm);
  gap: var(--space-xxs);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.older-button :deep(svg) {
  width: var(--size-icon-xs);
  height: var(--size-icon-xs);
}
</style>
