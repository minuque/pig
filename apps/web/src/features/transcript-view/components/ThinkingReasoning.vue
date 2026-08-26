<template>
  <div class="tr">
    <div v-if="!done" class="tr-header" role="status">
      <ThinkingOrb />
      <ThinkingState text="思考中…" />
    </div>
    <button
      v-else
      type="button"
      class="tr-header is-clickable"
      :aria-expanded="expanded"
      aria-label="切换思考过程"
      @click="toggle"
    >
      <span class="tr-label">{{ doneLabel }}</span>
      <svg class="tr-chevron" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
        <path
          d="m4.5 15.75 7.5-7.5 7.5 7.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <div class="tr-collapsible" :class="{ 'is-collapsed': !expanded }">
      <div class="tr-inner">
        <div
          ref="viewport"
          class="tr-viewport"
          :class="{ 'is-scroll': done && expanded }"
          :style="{ WebkitMaskImage: mask, maskImage: mask }"
          @scroll="onScroll"
        >
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef, useTemplateRef, watch } from "vue"
import ThinkingOrb from "@features/transcript-view/components/ThinkingOrb.vue"
import ThinkingState from "@features/transcript-view/components/ThinkingState.vue"

const COLLAPSE_MS = 360
const FADE = 16

const props = defineProps<{
  streaming: boolean
  content: string
}>()

const open = shallowRef(props.streaming)
const elapsedSec = shallowRef<number | null>(null)
const fadeTop = shallowRef(false)
const fadeBottom = shallowRef(true)
const startedAt = performance.now()
const viewport = useTemplateRef<HTMLElement>("viewport")
let collapseTimer = 0

const done = computed(() => !props.streaming)
const expanded = computed(() => (done.value ? open.value : true))
const doneLabel = computed(() =>
  elapsedSec.value != null ? `思考了 ${elapsedSec.value}s` : "思考过程",
)
const mask = computed(() => {
  if (!expanded.value) return "none"
  const top = fadeTop.value ? FADE : 0
  const bottom = fadeBottom.value ? FADE : 0
  return `linear-gradient(to bottom, transparent 0, #000 ${top}px, #000 calc(100% - ${bottom}px), transparent 100%)`
})

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function pinElapsed() {
  if (elapsedSec.value != null) return
  elapsedSec.value = Math.max(1, Math.round((performance.now() - startedAt) / 1000))
}

function collapseSoon() {
  pinElapsed()
  if (prefersReducedMotion()) {
    open.value = false
    return
  }
  collapseTimer = window.setTimeout(() => {
    open.value = false
    collapseTimer = 0
  }, COLLAPSE_MS)
}

function toggle() {
  if (!done.value) return
  const next = !open.value
  if (next) {
    const el = viewport.value
    if (el) {
      el.scrollTop = 0
      fadeTop.value = false
      fadeBottom.value = el.scrollHeight > el.clientHeight + 1
    }
  }
  open.value = next
}

function onScroll() {
  const el = viewport.value
  if (!el || !expanded.value) return
  fadeTop.value = el.scrollTop > 1
  fadeBottom.value = el.scrollTop + el.clientHeight < el.scrollHeight - 1
}

function scrollToLatest() {
  const el = viewport.value
  if (!el || done.value) return
  el.scrollTop = el.scrollHeight
  fadeTop.value = el.scrollHeight > el.clientHeight
  fadeBottom.value = false
}

watch(
  () => props.streaming,
  (streaming) => {
    if (collapseTimer) {
      clearTimeout(collapseTimer)
      collapseTimer = 0
    }
    if (streaming) {
      open.value = true
      return
    }
    collapseSoon()
  },
)

watch(
  () => props.content,
  () => {
    if (props.streaming) requestAnimationFrame(scrollToLatest)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  if (collapseTimer) clearTimeout(collapseTimer)
})
</script>

<style scoped>
.tr {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  margin-bottom: var(--spacing-xxs);
  animation: tr-block-in 320ms var(--ease-out) both;
}
@keyframes tr-block-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.tr-header {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  cursor: default;
}
.tr-header.is-clickable {
  cursor: pointer;
}
.tr-header:focus {
  outline: none;
}
.tr-header.is-clickable:focus-visible {
  outline: var(--focus-ring-width) solid var(--primary);
  outline-offset: var(--focus-ring-width);
}
.tr-label {
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  letter-spacing: -0.005em;
  line-height: 18px;
}
.tr-chevron {
  color: var(--ink-faint);
  transform: rotate(180deg);
  transition: transform 280ms var(--ease-out);
}
.tr-header[aria-expanded="true"] .tr-chevron {
  transform: rotate(0deg);
}
.tr-header.is-clickable:hover .tr-chevron,
.tr-header.is-clickable:hover .tr-label {
  color: var(--ink-muted);
}
.tr-collapsible {
  display: grid;
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows 320ms var(--ease-out),
    opacity 220ms ease;
}
.tr-collapsible.is-collapsed {
  grid-template-rows: 0fr;
  opacity: 0;
  pointer-events: none;
}
.tr-inner {
  min-height: 0;
  overflow: hidden;
}
.tr-viewport {
  max-height: 180px;
  margin-top: 6px;
  overflow: hidden;
  outline: none;
}
.tr-viewport.is-scroll {
  overflow-y: auto;
  scrollbar-width: none;
}
.tr-viewport.is-scroll::-webkit-scrollbar {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .tr {
    animation: none;
  }
  .tr-chevron,
  .tr-collapsible {
    transition: none;
  }
}
</style>
