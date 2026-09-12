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
          v-if="rendered"
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
          <TransitionGroup :appear="live" name="timeline-step" tag="div" class="step-list">
            <div
              v-for="(step, index) in row.steps"
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
const rendered = shallowRef(revealed.value)
const expanded = shallowRef(revealed.value)
const rootEl = shallowRef<HTMLElement | null>(null)

watch(
  revealed,
  (open) => {
    if (!open) {
      expanded.value = false
      return
    }
    const first = !rendered.value
    rendered.value = true
    if (!first) {
      expanded.value = true
      return
    }
    requestAnimationFrame(() => {
      if (revealed.value) expanded.value = true
    })
  },
  { flush: "sync" },
)

let viewportObserver: IntersectionObserver | undefined
let idleHandle: number | undefined
let idleViaTimeout = false

function cancelIdle() {
  if (idleHandle == null) return
  if (idleViaTimeout) window.clearTimeout(idleHandle)
  else cancelIdleCallback(idleHandle)
  idleHandle = undefined
}

function scheduleIdleMount() {
  if (rendered.value) return
  cancelIdle()
  const mount = () => {
    idleHandle = undefined
    if (!rendered.value) rendered.value = true
  }
  if (typeof requestIdleCallback === "function") {
    idleViaTimeout = false
    // timeout 避免主线程一直忙时永不挂载
    idleHandle = requestIdleCallback(mount, { timeout: 1000 })
    return
  }
  idleViaTimeout = true
  idleHandle = window.setTimeout(mount, 1)
}

function stopViewportWatch() {
  viewportObserver?.disconnect()
  viewportObserver = undefined
  cancelIdle()
}

function onViewport(entries: IntersectionObserverEntry[]) {
  if (rendered.value) {
    stopViewportWatch()
    return
  }
  if (entries.some((entry) => entry.isIntersecting)) {
    scheduleIdleMount()
    return
  }
  cancelIdle()
}

function startViewportWatch() {
  stopViewportWatch()
  if (!props.eager || rendered.value) return
  const target = rootEl.value
  if (!target) return
  viewportObserver = new IntersectionObserver(onViewport, {
    root: target.closest("#transcript-panel"),
    threshold: 0,
  })
  viewportObserver.observe(target)
}

watch(
  [() => props.eager, rendered, rootEl],
  () => {
    if (rendered.value || !props.eager) {
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

function measure() {
  const root = listEl.value
  if (!root) return
  const rootTop = root.getBoundingClientRect().top
  centers.value = [...root.querySelectorAll<HTMLElement>(":scope .step")].map((node) => {
    const hit = node.querySelector<HTMLElement>(".summary") ?? node
    const rect = hit.getBoundingClientRect()
    return rect.top - rootTop + rect.height / 2
  })
  if (!railReady.value && centers.value.some((y) => y > 0)) {
    requestAnimationFrame(() => {
      railReady.value = true
    })
  }
}

function onPointerEnter(index: number) {
  hoverIndex.value = index
  pointerInside.value = true
}

function onFocusIn(index: number) {
  hoverIndex.value = index
  focusInside.value = true
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

watch([expanded, () => props.row.steps.map((step) => step.id).join("\0")], () => {
  void nextTick(measure)
})

watch(
  listEl,
  (root) => {
    listObserver?.disconnect()
    listObserver = undefined
    if (!root) {
      railReady.value = false
      return
    }
    listObserver = new ResizeObserver(() => measure())
    listObserver.observe(root)
    void nextTick(measure)
  },
  { flush: "post" },
)

onBeforeUnmount(() => {
  listObserver?.disconnect()
  stopViewportWatch()
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
