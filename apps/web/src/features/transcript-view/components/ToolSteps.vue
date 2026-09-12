<template>
  <section ref="rootEl" class="tool-steps" :class="{ live, aborted: row.aborted }">
    <Button type="button" static class="summary-btn" @click="emit('toggle-expand', !revealed)">
      <Spinner v-if="live" class="tool-steps-icon" />
      <BadgeCheck v-else class="tool-steps-icon" />
      <span :class="{ shimmer: live }" :data-text="label">{{ label }}</span>
      <ChevronRight class="motion-turn" :class="{ 'is-on': revealed }" data-icon="inline-end" />
    </Button>

    <div
      class="tool-calls-group"
      :class="{ 'is-open': expanded, instant: live || !expanded }"
      :inert="!expanded"
    >
      <div>
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
          <TransitionGroup
            :appear="live"
            :css="live"
            name="timeline-step"
            tag="div"
            class="step-list"
          >
            <div
              v-for="(step, index) in renderedSteps"
              :key="step.id"
              class="step"
              :data-active="index === activeIndex"
              @mouseenter="onPointerEnter(index)"
              @focusin="onFocusIn(index)"
            >
              <ToolCall
                :step="step"
                :is-expand="expandedTools"
                @toggle="emit('toggle-tool', $event.id, $event.open)"
              />
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue"
import { ChevronRight, BadgeCheck } from "@lucide/vue"
import { Button } from "@components/ui/button/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import ToolCall from "./ToolCall.vue"
import { toolRowLabel } from "../lib/transcript-rows.js"
import type { ToolRow, ToolRowStep } from "../type.js"

const HOOK_CORNER = 6
const FIRST_MOUNT_SIZE = 1
const MOUNT_BATCH_SIZE = 2

const props = withDefaults(
  defineProps<{
    row: ToolRow
    isExpand: boolean | undefined
    expandedTools: Map<string, boolean>
    eager?: boolean
  }>(),
  { eager: false },
)
const emit = defineEmits<{
  "toggle-expand": [open: boolean]
  "toggle-tool": [id: string, open: boolean]
}>()

const live = computed(() => props.row.mode === "live")
const revealed = computed(() => props.row.turnStreaming || props.isExpand === true)
const renderedCount = shallowRef(revealed.value ? props.row.steps.length : 0)
const renderedSteps = computed(() => props.row.steps.slice(0, renderedCount.value))
const prepared = computed(() => renderedCount.value >= props.row.steps.length)
const expanded = shallowRef(revealed.value)
const rootEl = shallowRef<HTMLElement | null>(null)

let viewportObserver: IntersectionObserver | undefined
let idleHandle: number | undefined
let idleViaTimeout = false
let revealRaf = 0
let mountRaf = 0
let inViewport = false

function mountBatch(size = MOUNT_BATCH_SIZE) {
  renderedCount.value = Math.min(props.row.steps.length, renderedCount.value + size)
}

function cancelIdle() {
  if (idleHandle == null) return
  if (idleViaTimeout) window.clearTimeout(idleHandle)
  else cancelIdleCallback(idleHandle)
  idleHandle = undefined
}

function cancelForegroundMount() {
  if (revealRaf) cancelAnimationFrame(revealRaf)
  if (mountRaf) cancelAnimationFrame(mountRaf)
  revealRaf = 0
  mountRaf = 0
}

function scheduleForegroundMount() {
  cancelIdle()
  if (prepared.value || !revealed.value || mountRaf) return
  mountRaf = requestAnimationFrame(() => {
    mountRaf = 0
    if (!revealed.value) return
    mountBatch()
    if (!prepared.value) scheduleForegroundMount()
  })
}

watch(
  revealed,
  (open) => {
    if (!open) {
      cancelForegroundMount()
      expanded.value = false
      if (props.eager && inViewport) scheduleIdleMount()
      return
    }
    const first = renderedCount.value === 0
    if (first) mountBatch(FIRST_MOUNT_SIZE)
    if (!first) {
      expanded.value = true
      scheduleForegroundMount()
      return
    }
    revealRaf = requestAnimationFrame(() => {
      revealRaf = 0
      if (!revealed.value) return
      expanded.value = true
      scheduleForegroundMount()
    })
  },
  { flush: "sync" },
)

watch(
  [live, () => props.row.steps.length],
  ([isLive, length]) => {
    if (isLive || revealed.value) renderedCount.value = length
    else renderedCount.value = Math.min(renderedCount.value, length)
  },
  { flush: "sync" },
)

function scheduleIdleMount() {
  if (prepared.value || idleHandle != null || !inViewport) return
  const mount = () => {
    idleHandle = undefined
    if (!prepared.value && inViewport && !revealed.value) mountBatch()
    void nextTick(() => {
      if (!prepared.value && inViewport && !revealed.value) scheduleIdleMount()
    })
  }
  if (typeof requestIdleCallback === "function") {
    idleViaTimeout = false
    // 超时只挂一小批，避免后台准备重新形成长任务
    idleHandle = requestIdleCallback(mount, { timeout: 1000 })
    return
  }
  idleViaTimeout = true
  idleHandle = window.setTimeout(mount, 16)
}

function stopViewportWatch() {
  viewportObserver?.disconnect()
  viewportObserver = undefined
  inViewport = false
  cancelIdle()
}

function onViewport(entries: IntersectionObserverEntry[]) {
  if (prepared.value) {
    stopViewportWatch()
    return
  }
  inViewport = entries.some((entry) => entry.isIntersecting)
  if (inViewport) scheduleIdleMount()
  else cancelIdle()
}

function startViewportWatch() {
  stopViewportWatch()
  if (!props.eager || prepared.value) return
  const target = rootEl.value
  if (!target) return
  viewportObserver = new IntersectionObserver(onViewport, {
    root: target.closest("#transcript-panel"),
    threshold: 0,
  })
  viewportObserver.observe(target)
}

watch(
  [() => props.eager, prepared, rootEl],
  () => {
    if (prepared.value || !props.eager) {
      stopViewportWatch()
      return
    }
    startViewportWatch()
  },
  { flush: "post", immediate: true },
)

const label = computed(() => toolRowLabel(props.row))

function isStepRunning(step: ToolRowStep) {
  return step.type === "thought" ? step.streaming : step.items.some((item) => item.running)
}

const activeIndex = computed(() => {
  const steps = props.row.steps
  const running = steps.findIndex(isStepRunning)
  if (running >= 0) return running
  return steps.length > 0 ? steps.length - 1 : -1
})

const listEl = shallowRef<HTMLElement | null>(null)
const centers = shallowRef<number[]>([])
const railReady = shallowRef(false)
const hoverIndex = shallowRef<number | null>(null)
const pointerInside = shallowRef(false)
const focusInside = shallowRef(false)
let listObserver: ResizeObserver | undefined
let measureRaf = 0
let railReadyRaf = 0

function measure() {
  const root = listEl.value
  if (!root || !expanded.value || !prepared.value) return
  const rootTop = root.getBoundingClientRect().top
  const nodes = root.querySelectorAll<HTMLElement>(":scope .step")
  const next: number[] = []
  for (const index of new Set([activeIndex.value, hoverIndex.value])) {
    if (index == null || index < 0) continue
    const node = nodes.item(index)
    if (!node) continue
    const hit = node.querySelector<HTMLElement>(".summary") ?? node
    const rect = hit.getBoundingClientRect()
    next[index] = rect.top - rootTop + rect.height / 2
  }
  centers.value = next
  if (!railReady.value && next.some((y) => y > 0) && !railReadyRaf) {
    railReadyRaf = requestAnimationFrame(() => {
      railReadyRaf = 0
      if (expanded.value && prepared.value) railReady.value = true
    })
  }
}

function scheduleMeasure() {
  if (!expanded.value || !prepared.value || measureRaf) return
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
  const y = centers.value[activeIndex.value]
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
    hoverIndex.value !== activeIndex.value &&
    hoverY.value != null,
)

const accentBox = computed(() => railBox(0, activeY.value ?? 0))
const hoverBox = computed(() => railBox(hoverFrom.value, hoverY.value ?? 0))
const accentStemStyle = computed(() => accentBox.value.stem)
const accentCornerStyle = computed(() => accentBox.value.corner)
const hoverStemStyle = computed(() => hoverBox.value.stem)
const hoverCornerStyle = computed(() => hoverBox.value.corner)

watch([activeIndex, () => props.row.steps.map((step) => step.id).join("\0")], scheduleMeasure, {
  flush: "post",
})

watch(
  [listEl, expanded, prepared],
  ([root, open, ready]) => {
    listObserver?.disconnect()
    listObserver = undefined
    if (!root || !open || !ready) {
      centers.value = []
      railReady.value = false
      return
    }
    listObserver = new ResizeObserver(scheduleMeasure)
    listObserver.observe(root)
    void nextTick(scheduleMeasure)
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  listObserver?.disconnect()
  stopViewportWatch()
  cancelForegroundMount()
  if (measureRaf) cancelAnimationFrame(measureRaf)
  if (railReadyRaf) cancelAnimationFrame(railReadyRaf)
})
</script>

<style scoped>
.tool-steps {
  min-width: 0;
}

.summary-btn {
  height: auto;
  min-height: 28px;
  padding: 2px 0;
  gap: var(--spacing-xs);
  justify-content: flex-start;
  border-radius: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  white-space: normal;
  text-align: start;
  font-variant-numeric: tabular-nums;
}
.summary-btn:hover {
  background: transparent;
  color: var(--ink);
}
.aborted .summary-btn {
  color: var(--warning);
}

.tool-steps-icon {
  flex: none;
  transition: color var(--duration-fast) var(--ease-out);
}

.steps {
  position: relative;
  padding-block: var(--spacing-xs);
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.step {
  min-width: 0;
  padding-inline-start: calc(var(--size-icon) + var(--spacing-xs));
}

.hook-stem {
  background-image: repeating-linear-gradient(to top, transparent 0 2px, currentColor 2px 4px);
}

.hook-rail.accent {
  color: var(--ink-muted);
}
.live .hook-rail.accent {
  color: var(--primary);
}
.aborted .hook-rail.accent {
  color: var(--warning);
}
</style>
