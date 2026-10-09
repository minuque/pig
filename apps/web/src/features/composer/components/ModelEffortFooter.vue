<template>
  <div class="effort-card">
    <div class="effort-head">
      <span class="effort-spacer" aria-hidden="true"></span>
      <span class="effort-value">{{ currentLabel }}</span>

      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="effort-reset"
            :aria-label="t('composer.restoreDefaultEffort')"
            :disabled="isDefault"
            @click="reset"
          >
            <RestartIcon aria-hidden="true" />
          </button>
        </TooltipTrigger>

        <TooltipContent>{{ t("composer.restoreDefault") }}</TooltipContent>
      </Tooltip>
    </div>

    <div
      ref="track"
      class="effort-slider"
      role="slider"
      tabindex="0"
      :aria-label="t('composer.thinkingEffort')"
      :aria-valuemin="0"
      :aria-valuemax="lastIndex"
      :aria-valuenow="index"
      :aria-valuetext="currentLabel"
      :style="{ '--effort-p': percent }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @keydown="onKeydown"
    >
      <span class="effort-track">
        <span class="effort-fill effort-bar" :class="{ 'is-off': index === 0 }" />

        <span class="effort-marks" aria-hidden="true">
          <span
            v-for="mark in marks"
            :key="mark"
            class="effort-mark"
            :class="{ passed: mark <= percent }"
            :style="{ left: `${mark}%` }"
          />
        </span>

        <span class="effort-thumb" />
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { displayThinkingLevel, formatThinkingLevel } from "@features/composer/lib/thinking-level.js"
import { RestartIcon } from "@components/icons/index.js"

const { t } = useI18n()
const props = defineProps<{
  levels: readonly string[]
  level: string
}>()
const emit = defineEmits<{
  "update:level": [value: string]
}>()
const track = shallowRef<HTMLElement | null>(null)
const dragging = shallowRef(false)
const current = computed(() => displayThinkingLevel(props.level, props.levels))
const currentLabel = computed(() => formatThinkingLevel(current.value))
const index = computed(() => Math.max(0, props.levels.indexOf(current.value)))
const lastIndex = computed(() => Math.max(props.levels.length - 1, 0))
const percent = computed(() => (lastIndex.value === 0 ? 0 : (index.value / lastIndex.value) * 100))
const marks = computed(() =>
  props.levels.map((_, i) => (lastIndex.value === 0 ? 0 : (i / lastIndex.value) * 100)),
)
const isDefault = computed(() => index.value === 0)

function setIndex(next: number) {
  const level = props.levels[Math.min(lastIndex.value, Math.max(0, next))]

  if (level && level !== current.value) emit("update:level", level)
}

function indexFromEvent(event: PointerEvent) {
  const el = track.value

  if (!el || lastIndex.value === 0) return 0
  const rect = el.getBoundingClientRect()
  const span = Math.max(rect.width - 28, 1)
  const ratio = (event.clientX - rect.left - 14) / span
  return Math.round(Math.min(1, Math.max(0, ratio)) * lastIndex.value)
}

function onPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const el = event.currentTarget

  if (el instanceof HTMLElement) el.setPointerCapture(event.pointerId)
  dragging.value = true
  setIndex(indexFromEvent(event))
}

function onPointerMove(event: PointerEvent) {
  if (dragging.value) setIndex(indexFromEvent(event))
}

function onPointerUp() {
  dragging.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowRight" || event.key === "ArrowUp") setIndex(index.value + 1)
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") setIndex(index.value - 1)
  else if (event.key === "Home") setIndex(0)
  else if (event.key === "End") setIndex(lastIndex.value)
  else return
  event.preventDefault()
}

function reset() {
  setIndex(0)
}
</script>

<style scoped>
.effort-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding: var(--spacing-xxs) var(--spacing-xs) var(--spacing-xs);
  border-top: var(--border-width) solid var(--border);
}

.effort-head {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: var(--spacing-xxs);
}

.effort-value {
  overflow: hidden;
  color: var(--primary);
  font-size: var(--text-button);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-button--line-height);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.effort-reset {
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}

.effort-reset svg {
  width: 14px;
  height: 14px;
}

.effort-reset:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--ink);
}

.effort-reset:disabled {
  opacity: 0.35;
  cursor: default;
}

.effort-slider {
  position: relative;
  height: 28px;
  touch-action: none;
  cursor: grab;
}

.effort-slider:active {
  cursor: grabbing;
}

.effort-track {
  position: absolute;
  inset: 2px 0;
  border-radius: var(--radius-full);
  background: var(--effort-track);
}

.effort-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(14px + (100% - 28px) * var(--effort-p) / 100);
  border-radius: inherit;
  background: var(--effort-fill);
}

.effort-fill.is-off {
  opacity: 0;
}

.effort-marks {
  position: absolute;
  inset: 0 14px;
  pointer-events: none;
}

.effort-mark {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: var(--radius-full);
  background: var(--ink-faint);
  transform: translate(-50%, -50%);
}

.effort-mark.passed {
  background: var(--white);
  opacity: 0.55;
}

.effort-thumb {
  position: absolute;
  top: 50%;
  left: calc(14px + (100% - 28px) * var(--effort-p) / 100);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-full);
  background: var(--white);
  box-shadow: var(--shadow-soft);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

@media (prefers-reduced-motion: no-preference) {
  .effort-fill,
  .effort-thumb,
  .effort-mark {
    transition:
      left var(--duration-fast) var(--ease-spring),
      width var(--duration-fast) var(--ease-spring),
      opacity var(--duration-fast) var(--ease-out);
  }

  .effort-slider:active .effort-fill,
  .effort-slider:active .effort-thumb {
    transition: none;
  }
}
</style>
