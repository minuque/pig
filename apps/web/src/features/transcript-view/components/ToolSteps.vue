<template>
  <section class="tool-steps" :class="{ running, aborted: row.aborted }">
    <Button type="button" static class="summary-btn" :style="statusColor" @click="toggleSteps">
      <LoaderCircle
        v-if="running"
        class="tool-steps-icon animate-spin motion-reduce:animate-none"
      />

      <ClockAlert v-else-if="row.aborted || row.error" class="tool-steps-icon" />
      <BadgeCheck v-else class="tool-steps-icon" />

      <span>
        <template v-for="(part, i) in labelParts" :key="i">
          <span v-if="i" class="label-dot">·</span>
          <template v-if="part.kind === 'text'">{{ part.text }}</template>

          <template v-else>
            {{ part.prefix }}
            <span class="success-n">{{ part.count }}</span>
            {{ part.suffix }}
          </template>
        </template>

        <template v-if="failCount">
          <span class="label-dot">·</span>
          {{ t("transcript.statusError") }}
          <span class="fail-n">{{ failCount }}</span>
          {{ t("common.times") }}
        </template>

        <template v-if="durationLabel">
          <span class="label-dot">·</span>
          <span>{{ durationLabel }}</span>
        </template>
      </span>

      <ChevronRight class="motion-turn" :class="{ 'is-on': revealed }" data-icon="inline-end" />
    </Button>

    <div
      class="tool-calls-group"
      :class="{ 'is-open': revealed, instant: skipHeightMotion }"
      :inert="!revealed"
    >
      <div class="panel-slide">
        <div v-if="renderedSteps.length" ref="listEl" class="steps">
          <svg class="step-rail" :style="statusColor" aria-hidden="true">
            <path v-for="(path, i) in railPaths" :key="i" v-bind="path" />
          </svg>

          <div class="step-list">
            <div
              v-for="(step, index) in renderedSteps"
              :key="step.id"
              class="step"
              :class="{ 'is-arriving': starts.has(step.id) }"
              :data-active="index === displayActiveIndex"
              :style="arrivalStyle(step.id)"
            >
              <ToolCall
                :step="step"
                :is-expand="expandedTools"
                @toggle="emit('toggle-tool', $event.id, $event.open)"
              />
            </div>

            <div
              v-if="showMoreToggle"
              class="step"
              :data-active="displayActiveIndex === renderedSteps.length"
            >
              <div class="tool-summary">
                <Button type="button" static class="summary" @click="toggleMore">
                  <Ellipsis class="tool-icon" data-icon="inline-start" />
                  <span class="label" :data-text="moreLabel">{{ moreLabel }}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { ChevronRight, BadgeCheck, ClockAlert, Ellipsis, LoaderCircle } from "@lucide/vue"
import { useI18n } from "@i18n/index.js"
import { Button } from "@components/ui/button/index.js"
import ToolCall from "@features/transcript-view/components/ToolCall.vue"
import {
  toolRowDurationLabel,
  toolRowFailCount,
  toolRowLabelParts,
} from "@features/transcript-view/lib/transcript-row-label.js"
import { holdClickedOffset } from "@features/transcript-view/lib/transcript-scroll.js"
import { toolGroupKey } from "@features/transcript-view/lib/tool-summary.js"
import {
  STEP_REVEAL_MS,
  STEP_STAGGER_MS,
  arrivalProgress,
  buildRailPaths,
  type RailPath,
} from "@features/transcript-view/lib/step-rail.js"
import type { ToolRow, ToolRowStep } from "@features/transcript-view/type.js"

const { t } = useI18n()
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
/** read 图片没有可折叠的正文，默认展开直接看；用户点过就听用户的。 */
const hasReadImage = computed(() =>
  props.row.steps.some(
    (step) =>
      step.type === "tools" &&
      step.items.some(
        (item) => toolGroupKey(item.toolName) === "read" && item.outputImages.length > 0,
      ),
  ),
)
const revealed = computed(() => {
  if (running.value) return true

  if (props.isExpand !== undefined) return props.isExpand
  return hasReadImage.value
})

function toggleSteps(event: MouseEvent) {
  const button = event.currentTarget

  if (revealed.value && button instanceof HTMLElement) holdClickedOffset(button)
  emit("toggle-expand", !revealed.value)
}

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
const showMoreToggle = computed(
  () => keptMounted.value && !running.value && props.row.steps.length > PAGE_SIZE,
)
const moreLabel = computed(() => (hiddenCount.value ? t("common.showMore") : t("common.collapse")))
// 长列表只跳过展开动画，收起仍走高度过渡
const skipHeightMotion = computed(
  () => running.value || (revealed.value && renderedSteps.value.length > ANIMATED_EXPAND_LIMIT),
)

function toggleMore() {
  pageLimit.value = hiddenCount.value ? props.row.steps.length : PAGE_SIZE
}

const now = shallowRef(Date.now())
const tick = useIntervalFn(
  () => {
    now.value = Date.now()
  },
  1000,
  { immediate: false },
)

watch(
  [revealed, running, () => props.row.steps.length],
  ([open, isRunning, length]) => {
    if (open) keptMounted.value = true
    now.value = Date.now()

    if (isRunning) {
      pageLimit.value = Math.max(PAGE_SIZE, length)
      tick.resume()
    } else {
      pageLimit.value = Math.min(Math.max(PAGE_SIZE, pageLimit.value), length)
      tick.pause()
    }
  },
  { flush: "sync", immediate: true },
)

const labelParts = computed(() => toolRowLabelParts(props.row))
const failCount = computed(() => toolRowFailCount(props.row))
const durationLabel = computed(() => toolRowDurationLabel(props.row, now.value))

function isStepRunning(step: ToolRowStep) {
  return step.type === "thought" ? step.streaming : step.items.some((item) => item.running)
}

const activeIndex = computed(() => {
  const steps = props.row.steps
  const runningIndex = steps.findIndex(isStepRunning)

  if (runningIndex >= 0) return runningIndex
  return steps.length > 0 ? steps.length - 1 : -1
})
const moreIndex = computed(() => (showMoreToggle.value ? renderedSteps.value.length : -1))
const displayActiveIndex = computed(() => {
  if (renderedSteps.value.length === 0 || activeIndex.value < 0) return -1

  if (moreIndex.value >= 0 && !running.value) return moreIndex.value
  const last = moreIndex.value >= 0 ? moreIndex.value : renderedSteps.value.length - 1
  return Math.min(activeIndex.value, last)
})
const listEl = shallowRef<HTMLElement | null>(null)
const railPaths = shallowRef<RailPath[]>([])
// 挂载时已有的步骤算历史，不播 arrival；只有运行中新到的步骤才长线
const seen = new Set(props.row.steps.map((step) => step.id))
const starts = shallowRef(new Map<string, number>())
const reduceMotion =
  typeof window === "undefined"
    ? { matches: false }
    : window.matchMedia("(prefers-reduced-motion: reduce)")
let listObserver: ResizeObserver | undefined
let railFrame = 0
let railTimer: ReturnType<typeof setTimeout> | undefined

function arrivalStyle(id: string) {
  const start = starts.value.get(id)
  return start === undefined ? undefined : { animationDelay: `${start - Date.now()}ms` }
}

// offset* 只读布局位置，arrival 位移和面板滑入的 transform 都不干扰；summary 在行顶，sticky 时不跟着漂
function rebuildRail() {
  const root = listEl.value

  if (!root) return
  const centers: number[] = []

  for (const node of root.querySelectorAll<HTMLElement>(":scope > .step-list > .step")) {
    const hit = node.querySelector<HTMLElement>(".summary") ?? node
    centers.push(node.offsetTop + hit.offsetHeight / 2)
  }

  const at = Date.now()
  const progress = renderedSteps.value.map((step) => arrivalProgress(starts.value.get(step.id), at))
  railPaths.value = buildRailPaths({ centers, progress })
}

function stopRailLoop() {
  cancelAnimationFrame(railFrame)
  clearTimeout(railTimer)
  railFrame = 0
}

function runRailLoop() {
  const end = Math.max(...starts.value.values()) + STEP_REVEAL_MS
  const tick = () => {
    if (Date.now() < end) {
      rebuildRail()
      railFrame = requestAnimationFrame(tick)
      return
    }

    stopRailLoop()
    starts.value = new Map()
  }

  stopRailLoop()
  railFrame = requestAnimationFrame(tick)
  // 窗口遮挡时 rAF 不跑，超时直接落到终态
  railTimer = setTimeout(tick, end - Date.now())
}

watch(
  renderedSteps,
  (steps) => {
    const now = Date.now()
    let next: Map<string, number> | undefined
    let rank = 0

    for (const step of steps) {
      if (seen.has(step.id)) continue
      seen.add(step.id)

      if (!running.value || reduceMotion.matches) continue
      next ??= new Map(starts.value)
      next.set(step.id, now + rank * STEP_STAGGER_MS)
      rank += 1
    }

    if (next) starts.value = next
  },
  { flush: "sync" },
)

watch(
  listEl,
  (root) => {
    listObserver?.disconnect()
    listObserver = undefined

    if (!root) return
    // 步骤开合、换行都会改 .steps 尺寸；RO 在布局后、绘制前回调，同帧跟随
    listObserver = new ResizeObserver(rebuildRail)
    listObserver.observe(root)
  },
  { flush: "post" },
)

watch(
  starts,
  (map) => {
    if (map.size) runRailLoop()
    else rebuildRail()
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  listObserver?.disconnect()
  stopRailLoop()
})
</script>

<style scoped>
.tool-steps {
  --tool-summary-offset: calc(var(--text-body-sm) * var(--text-body-sm--line-height));
  isolation: isolate;
  min-width: 0;
}

.summary-btn {
  position: sticky;
  top: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  height: auto;
  min-height: var(--tool-summary-offset);
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

/* 箭头与折叠高度同钟 */
.summary-btn .motion-turn {
  transition-duration: var(--duration-tool-fold);
  transition-timing-function: var(--ease-fold);
}

.tool-steps-icon {
  flex: none;
  transition: color var(--duration-fast) var(--ease-out);
}

.label-dot {
  font-weight: var(--font-weight-bold);
  margin-inline: 0.35em;
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

.step-rail {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  color: var(--hairline);
}

.running .step-rail {
  color: var(--primary);
}

.aborted .step-rail {
  color: var(--warning);
}

.step-rail path {
  fill: none;
  stroke: currentColor;
  stroke-width: var(--border-width);
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

.step.is-arriving {
  animation: step-arrive var(--duration-settle) var(--ease-settle) both;
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
</style>
