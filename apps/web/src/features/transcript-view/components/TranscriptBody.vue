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

      <div class="transcript-frame">
        <div v-if="rows.length || running" ref="column" class="transcript">
          <div ref="list" class="transcript-list">
            <div class="timeline-rows">
              <template v-for="(turn, turnIndex) in turns" :key="turn.id">
                <TurnRow
                  :turn="turn"
                  :class="{ 'turn-runway': turn.id === runwayId }"
                  :session-id="sessionId"
                  :running="running"
                  :is-expand="isExpand"
                  :expanded-tools="expandedTools"
                  :eager="turnIndex >= turns.length - EAGER_TURNS || shownTurns.has(turn.id)"
                  @toggle-expand="onToggleExpand"
                  @toggle-tool="onToggleTool"
                  @shown="shownTurns.add($event)"
                >
                  <TranscriptStatus v-if="turnIndex === turns.length - 1" v-bind="statusProps" />
                </TurnRow>
              </template>
            </div>

            <TranscriptStatus v-if="turns.length === 0" v-bind="statusProps" />
            <slot name="queue" />
          </div>
        </div>

        <div class="transcript-aside"><slot /></div>
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
  provide,
  shallowRef,
  toRef,
  useTemplateRef,
  watch,
} from "vue"
import SessionLoading from "@features/transcript-view/components/SessionLoading.vue"
import TranscriptMinimap from "@features/transcript-view/components/TranscriptMinimap.vue"
import TranscriptStatus from "@features/transcript-view/components/TranscriptStatus.vue"
import TurnRow from "@features/transcript-view/components/TurnRow.vue"
import { useTranscriptExpand } from "@features/transcript-view/hooks/use-transcript-expand.js"
import { useTranscriptFollow } from "@features/transcript-view/hooks/use-transcript-follow.js"
import { useTranscriptMinimap } from "@features/transcript-view/hooks/use-transcript-minimap.js"
import { useTranscriptPosition } from "@features/transcript-view/hooks/use-transcript-position.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-edge.js"
import { TRANSCRIPT_SESSION_ID } from "@features/transcript-view/hooks/use-full-tool-output.js"
import type { SessionPhase, TranscriptItem } from "@/types/common-type.js"
import type { TurnTiming } from "@/types/common-type.js"
import { MINIMAP_MIN_ITEMS } from "@features/transcript-view/lib/transcript-minimap.js"
import type { TimelineTurn, TranscriptMinimapItem } from "@features/transcript-view/type.js"
import { createTimelineRowsBuilder } from "@features/transcript-view/lib/transcript-rows.js"
import { EAGER_TURNS, shownTurnsOf } from "@features/transcript-view/lib/shown-turns.js"
import { turnOutputTokens } from "@features/transcript-view/lib/transcript-activity.js"
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
    phase?: SessionPhase | undefined
    sending?: boolean
    stopping?: boolean
    timings?: readonly TurnTiming[] | undefined
  }>(),
  { sending: false, stopping: false },
)

provide(TRANSCRIPT_SESSION_ID, toRef(props, "sessionId"))

const turns = shallowRef<TimelineTurn[]>([])
const shownTurns = computed(() => shownTurnsOf(props.sessionId))
const rows = computed(() => turns.value.flatMap((turn) => turn.rows))
const rowsBuilder = createTimelineRowsBuilder()
const activeStartedAt = computed(() => {
  if (!props.running) return undefined
  const lastId = turns.value.at(-1)?.id
  const timing = props.timings?.find(
    (value) => value.userId === lastId && value.outcome === "running",
  )
  return timing?.startedAt
})
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
  restoreScrollTop,
} = useTranscriptFollow(scrollerRoot)
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

const { readyFrame } = useTranscriptReveal(rows)
const runwayId = shallowRef<string>()

useTranscriptPosition({
  sessionId: () => props.sessionId,
  ready: () => turns.value.length > 0 && list.value !== null,
  readScrollTop: () => scrollerRoot()?.scrollTop,
  restore: restoreScrollTop,
  pinLatest,
  onSessionChange: () => {
    runwayId.value = undefined
    rowsBuilder.reset()
    reset()
  },
})

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
  () => {
    observeSizes()
  },
  { flush: "post" },
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
  overflow-anchor: none;
  scroll-padding-bottom: var(--composer-reserve, 0px);
  container-type: size;
  --scrollbar-thumb: var(--scrollbar-color);
  scrollbar-gutter: stable both-edges;
}

.transcript-edge-top {
  background: linear-gradient(to bottom, var(--bg), transparent);
}

.turn-runway {
  min-height: calc(100cqh - 48px - var(--edge-fade-band) - var(--composer-reserve, 0px));
}

.transcript-viewport:has(.code-more-menu) {
  z-index: var(--z-overlay);
}

.transcript-frame {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
}

.transcript-aside {
  position: sticky;
  inset-block-start: 0;
  z-index: var(--z-sticky);
  grid-column: 2;
  display: flex;
  flex-direction: column;
  max-block-size: 100cqh;
}

.transcript {
  box-sizing: border-box;
  grid-column: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-block-size: 100cqh;
  padding-top: 48px;
  padding-bottom: calc(48px + var(--composer-reserve, 0px));
  padding-inline-start: max(var(--space-2xl), calc((100% - var(--content-width)) / 2));
  padding-inline-end: max(var(--space-2xl), calc((100% - var(--content-width)) / 2));
  overflow-x: clip;
}

@media (max-width: 780px) {
  .transcript {
    padding-inline: 20px;
  }
}

.transcript-list,
.timeline-rows {
  box-sizing: border-box;
  width: 100%;
}

.transcript-list {
  display: flex;
  flex: 1;
  flex-direction: column;
}
</style>
