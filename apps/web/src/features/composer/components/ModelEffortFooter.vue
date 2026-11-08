<template>
  <div class="effort-card">
    <div class="effort-head">
      <span class="effort-spacer" aria-hidden="true"></span>
      <span :key="currentLabel" class="effort-value motion-blur-in">{{ currentLabel }}</span>

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
      :class="{ dragging }"
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
        <span class="effort-fill" :class="{ 'is-off': index === 0 }" />

        <span class="effort-marks" aria-hidden="true">
          <span
            v-for="(mark, i) in marks"
            :key="mark"
            class="effort-mark"
            :class="{ passed: mark <= percent && index > 0 }"
            :style="{ left: `${mark}%`, '--mark-h': markHeight(i) }"
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

/** 刻度由低到高逐级加高，暗示强度递增。 */
function markHeight(i: number) {
  const ratio = lastIndex.value === 0 ? 0 : i / lastIndex.value
  return `${5 + ratio * 5}px`
}

function setIndex(next: number) {
  const level = props.levels[Math.min(lastIndex.value, Math.max(0, next))]

  if (level && level !== current.value) emit("update:level", level)
}

function indexFromEvent(event: PointerEvent) {
  const el = track.value

  if (!el || lastIndex.value === 0) return 0
  const rect = el.getBoundingClientRect()
  const span = Math.max(rect.width - 32, 1)
  const ratio = (event.clientX - rect.left - 16) / span
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
  gap: var(--space-xxs);
  padding: var(--space-xxs) var(--space-xs) var(--space-xs);
  border-top: var(--border-width) solid var(--border-soft);
}

.effort-head {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: var(--space-xxs);
}

.effort-value {
  overflow: hidden;
  color: var(--primary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
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
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--contrast-foreground);
  cursor: pointer;
}

.effort-reset svg {
  width: 14px;
  height: 14px;
}

.effort-reset:hover:not(:disabled) {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.effort-reset:disabled {
  opacity: 0.35;
  cursor: default;
}

/* 32px 胶囊轨：渐变填充一直铺到滑块，滑块是白色胶囊，拖动时变宽 */
.effort-slider {
  position: relative;
  height: 32px;
  margin-top: var(--space-xxs);
  border-radius: var(--radius-pill);
  touch-action: none;
  cursor: grab;
}

.effort-slider.dragging {
  cursor: grabbing;
}

.effort-slider:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.effort-track {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  background: var(--effort-track);
}

.effort-fill {
  position: absolute;
  inset: 0 auto 0 0;
  width: calc(32px + (100% - 32px) * var(--effort-p) / 100);
  border-radius: inherit;
  background: var(--effort-fill);
  box-shadow: var(--effort-fill-highlight);
}

.effort-fill.is-off {
  opacity: 0;
}

.effort-marks {
  position: absolute;
  inset: 0 16px;
  pointer-events: none;
}

.effort-mark {
  position: absolute;
  top: 50%;
  width: 1.5px;
  height: var(--mark-h);
  border-radius: var(--radius-pill);
  background: var(--effort-tick);
  transform: translate(-50%, -50%);
}

.effort-mark.passed {
  background: var(--effort-tick-on);
}

.effort-thumb {
  position: absolute;
  top: 50%;
  left: calc(16px + (100% - 32px) * var(--effort-p) / 100);
  width: 26px;
  height: 26px;
  border-radius: var(--radius-pill);
  background: var(--effort-thumb);
  box-shadow: var(--effort-thumb-shadow);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.effort-slider.dragging .effort-thumb {
  width: 32px;
}

@media (prefers-reduced-motion: no-preference) {
  .effort-fill,
  .effort-thumb,
  .effort-mark {
    transition:
      left var(--duration-normal) var(--ease-out),
      width var(--duration-normal) var(--ease-out),
      opacity var(--duration-fast) var(--ease-out),
      background-color var(--duration-fast) var(--ease-out);
  }
}
</style>
