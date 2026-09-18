<template>
  <section class="tool-steps" :class="{ running, aborted: row.aborted }">
    <Button
      type="button"
      static
      class="summary-btn"
      :style="statusColor"
      @click="emit('toggle-expand', !revealed)"
    >
      <Spinner v-if="running" class="tool-steps-icon" />
      <ClockAlert v-else-if="row.aborted || row.error" class="tool-steps-icon" />
      <BadgeCheck v-else class="tool-steps-icon" />
      <!-- prettier-ignore -->
      <span :class="{ shimmer: running }" :data-text="label"><template v-for="(part, i) in labelParts" :key="i"><template v-if="i"> · </template><template v-if="part.kind === 'text'">{{ part.text }}</template><template v-else>{{ part.prefix }} <span class="success-n">{{ part.count }}</span> {{ part.suffix }}</template></template><template v-if="failCount"> · 执行失败 <span class="fail-n">{{ failCount }}</span> 次</template></span>
      <ChevronRight class="motion-turn" :class="{ 'is-on': revealed }" data-icon="inline-end" />
    </Button>

    <div
      class="tool-calls-group"
      :class="{ 'is-open': expanded, instant: skipHeightMotion }"
      :inert="!expanded"
    >
      <div>
        <div class="panel-slide" :data-open="expanded ? 'true' : 'false'">
          <div
            v-if="renderedSteps.length"
            ref="listEl"
            class="steps"
            @mouseleave="pointerInside = false"
            @focusout="onFocusOut"
          >
            <span
              class="hook-rail"
              :class="{ 'is-on': hoverVisible, 'is-ready': railReady }"
              aria-hidden="true"
            >
              <span class="hook-stem" :style="hoverStemStyle" />

              <svg
                class="hook-corner"
                :style="hoverCornerStyle"
                width="12"
                height="7"
                viewBox="0 0 12 7"
                fill="none"
              >
                <path d="M0.5 0a6 6 0 0 0 6 6H12" stroke="currentColor" stroke-dasharray="2 2" />
              </svg>
            </span>

            <span
              class="hook-rail accent"
              :class="{ 'is-on': accentVisible, 'is-ready': railReady }"
              :style="statusColor"
              aria-hidden="true"
            >
              <span class="hook-stem" :style="accentStemStyle" />

              <svg
                class="hook-corner"
                :style="accentCornerStyle"
                width="12"
                height="7"
                viewBox="0 0 12 7"
                fill="none"
              >
                <path d="M0.5 0a6 6 0 0 0 6 6H12" stroke="currentColor" stroke-dasharray="2 2" />
              </svg>
            </span>

            <div class="step-list">
              <div
                v-for="(step, index) in renderedSteps"
                :key="step.id"
                class="step"
                :data-active="index === displayActiveIndex"
                @mouseenter="onPointerEnter(index)"
                @focusin="onFocusIn(index)"
              >
                <ToolCall
                  :step="step"
                  :is-expand="expandedTools"
                  @toggle="emit('toggle-tool', $event.id, $event.open)"
                />
              </div>

              <div
                v-if="hiddenCount"
                class="step"
                :data-active="displayActiveIndex === renderedSteps.length"
                @mouseenter="onPointerEnter(renderedSteps.length)"
                @focusin="onFocusIn(renderedSteps.length)"
              >
                <div class="tool-summary">
                  <Button type="button" static class="summary" @click="loadMore">
                    <Ellipsis class="tool-icon" data-icon="inline-start" />
                    <span class="label" data-text="加载更多">加载更多</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue"
import { ChevronRight, BadgeCheck, ClockAlert, Ellipsis } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import ToolCall from "./ToolCall.vue"
import { toolRowFailCount, toolRowLabel, toolRowLabelParts } from "../lib/transcript-rows.js"
import type { ToolRow, ToolRowStep } from "../type.js"

const HOOK_CORNER = 6
const PAGE_SIZE = 8
const ANIMATED_EXPAND_LIMIT = 8
const props = defineProps<{
  row: ToolRow
  isExpand: boolean | undefined
  expandedTools: Map<string, boolean>
}>()
const emit = defineEmits<{
  "toggle-expand": [open: boolean]
  "toggle-tool": [id: string, open: boolean]
}>()
const running = computed(() => props.row.mode === "live")
const statusColor = computed(() => (props.row.aborted ? { color: "var(--warning)" } : undefined))
const revealed = computed(() => running.value || props.isExpand === true)
const expanded = shallowRef(revealed.value)
const keptMounted = shallowRef(revealed.value)
const pageLimit = shallowRef(
  running.value ? Math.max(PAGE_SIZE, props.row.steps.length) : PAGE_SIZE,
)
const renderedSteps = computed(() =>
  keptMounted.value ? props.row.steps.slice(0, pageLimit.value) : [],
)
const hiddenCount = computed(() =>
  keptMounted.value ? Math.max(0, props.row.steps.length - renderedSteps.value.length) : 0,
)
const skipHeightMotion = computed(
  () => running.value || renderedSteps.value.length > ANIMATED_EXPAND_LIMIT,
)

function loadMore() {
  pageLimit.value = Math.min(props.row.steps.length, pageLimit.value + PAGE_SIZE)
}

watch(
  revealed,
  (open) => {
    if (open) keptMounted.value = true

    if (!open || skipHeightMotion.value) {
      expanded.value = open
      return
    }

    nextTick(() => {
      void listEl.value?.offsetHeight
      expanded.value = revealed.value
    })
  },
  { flush: "sync" },
)

watch(
  [running, () => props.row.steps.length],
  ([isRunning, length]) => {
    if (isRunning) pageLimit.value = Math.max(PAGE_SIZE, length)
    else pageLimit.value = Math.min(Math.max(PAGE_SIZE, pageLimit.value), length)
  },
  { flush: "sync" },
)

const label = computed(() => toolRowLabel(props.row))
const labelParts = computed(() => toolRowLabelParts(props.row))
const failCount = computed(() => toolRowFailCount(props.row))

function isStepRunning(step: ToolRowStep) {
  return step.type === "thought" ? step.streaming : step.items.some((item) => item.running)
}

const activeIndex = computed(() => {
  const steps = props.row.steps
  const runningIndex = steps.findIndex(isStepRunning)

  if (runningIndex >= 0) return runningIndex
  return steps.length > 0 ? steps.length - 1 : -1
})
const moreIndex = computed(() => (hiddenCount.value ? renderedSteps.value.length : -1))
const displayActiveIndex = computed(() => {
  const last = moreIndex.value >= 0 ? moreIndex.value : renderedSteps.value.length - 1

  if (last < 0 || activeIndex.value < 0) return -1
  return Math.min(activeIndex.value, last)
})
const listEl = shallowRef<HTMLElement | null>(null)
const centers = shallowRef<number[]>([])
const railReady = shallowRef(false)
const hoverIndex = shallowRef<number | null>(null)
const pointerInside = shallowRef(false)
const focusInside = shallowRef(false)
let listObserver: ResizeObserver | undefined
let measureRaf = 0

function measure() {
  const root = listEl.value

  if (!root || !expanded.value) return
  const rootTop = root.getBoundingClientRect().top
  const nodes = root.querySelectorAll<HTMLElement>(":scope .step")
  const next: number[] = []

  for (const index of new Set([displayActiveIndex.value, hoverIndex.value])) {
    if (index == null || index < 0) continue
    const node = nodes.item(index)

    if (!node) continue
    const hit = node.querySelector<HTMLElement>(".summary") ?? node
    const rect = hit.getBoundingClientRect()
    next[index] = rect.top - rootTop + rect.height / 2
  }

  centers.value = next

  if (!railReady.value && next.some((y) => y > 0)) railReady.value = true
}

function scheduleMeasure() {
  if (!expanded.value || measureRaf) return
  measureRaf = requestAnimationFrame(() => {
    measureRaf = 0
    measure()
  })
}

function onPointerEnter(index: number) {
  hoverIndex.value = index
  pointerInside.value = true
  scheduleMeasure()
}

function onFocusIn(index: number) {
  hoverIndex.value = index
  focusInside.value = true
  scheduleMeasure()
}

function onFocusOut(event: FocusEvent) {
  const root = listEl.value

  if (root && event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return
  focusInside.value = false
}

function railBox(from: number, y: number) {
  return {
    stem: { top: `${from}px`, height: `${Math.max(0, y - HOOK_CORNER - from)}px` },
    corner: { top: `${y - HOOK_CORNER}px` },
  }
}

const activeY = computed(() => {
  const y = centers.value[displayActiveIndex.value]
  return y == null ? null : y
})
const hoverY = computed(() => {
  const index = hoverIndex.value

  if (index == null) return null
  const y = centers.value[index]
  return y == null ? null : y
})
const hoverFrom = computed(() => {
  const accent = activeY.value
  const hover = hoverY.value

  if (accent != null && hover != null && hover <= accent) return Math.max(0, hover - HOOK_CORNER)
  return accent ?? 0
})
const accentVisible = computed(() => activeY.value != null)
const hoverVisible = computed(
  () =>
    (pointerInside.value || focusInside.value) &&
    hoverIndex.value !== displayActiveIndex.value &&
    hoverY.value != null,
)
const accentBox = computed(() => railBox(0, activeY.value ?? 0))
const hoverBox = computed(() => railBox(hoverFrom.value, hoverY.value ?? 0))
const accentStemStyle = computed(() => accentBox.value.stem)
const accentCornerStyle = computed(() => accentBox.value.corner)
const hoverStemStyle = computed(() => hoverBox.value.stem)
const hoverCornerStyle = computed(() => hoverBox.value.corner)

watch(
  [displayActiveIndex, moreIndex, expanded],
  () => {
    if (expanded.value) measure()
  },
  { flush: "post" },
)

watch(
  [listEl, expanded],
  ([root, open]) => {
    listObserver?.disconnect()
    listObserver = undefined

    if (!root || !open) {
      centers.value = []
      railReady.value = false
      return
    }

    listObserver = new ResizeObserver(scheduleMeasure)
    listObserver.observe(root)
    measure()
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  listObserver?.disconnect()

  if (measureRaf) cancelAnimationFrame(measureRaf)
})
</script>

<style scoped>
.tool-steps {
  isolation: isolate;
  min-width: 0;
}

.summary-btn {
  position: sticky;
  top: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  height: var(--size-icon-button);
  min-height: var(--size-icon-button);
  padding: 0;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-radius: 0;
  background: var(--surface);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  white-space: normal;
  text-align: start;
  font-variant-numeric: tabular-nums;
}

.summary-btn:hover {
  background: var(--surface);
  color: var(--ink);
}

.aborted .summary-btn {
  color: var(--warning);
}

.tool-calls-group {
  position: relative;
  z-index: 0;
}

.tool-steps-icon {
  flex: none;
  transition: color var(--duration-fast) var(--ease-out);
}

.fail-n {
  color: var(--danger);
}

.success-n {
  color: var(--success);
}

.steps {
  position: relative;
  min-width: 0;
  padding-block: var(--spacing-xs);
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
}

.step {
  min-width: 0;
  padding-inline-start: calc(var(--size-icon) + var(--spacing-xs));
}

.tool-summary {
  min-width: 0;
}

.summary {
  width: 100%;
  height: auto;
  min-height: var(--size-icon-button);
  min-width: 0;
  padding: 2px 0;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  text-align: start;
}

.summary:hover {
  background: transparent;
  color: var(--ink);
}

.tool-icon {
  position: relative;
  z-index: 1;
  transition: color var(--duration-fast) var(--ease-out);
}

.label {
  flex: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hook-stem {
  background-image: repeating-linear-gradient(to top, transparent 0 2px, currentColor 2px 4px);
}

.hook-rail.accent {
  color: var(--ink-muted);
}

.running .hook-rail.accent {
  color: var(--primary);
}

.aborted .hook-rail.accent {
  color: var(--warning);
}

.running .hook-stem,
.running .hook-corner {
  transition: none;
}
</style>
