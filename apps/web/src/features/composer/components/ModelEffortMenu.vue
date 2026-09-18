<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        static
        class="chip"
        :aria-label="`思考强度：${label}`"
        :title="label"
        @pointerdown.stop
        @click.stop
      >
        {{ label }}
        <ChevronRight class="chip-caret" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="end"
      :side-offset="4"
      class="effort-pop"
      data-model-effort-menu
    >
      <div class="effort" @pointerdown.stop @wheel.prevent="onWheel">
        <div class="effort-scale">
          <span>更快</span>
          <span>更强</span>
        </div>

        <div class="effort-bar" :style="{ '--effort-mix': `${effortMix}%` }">
          <div class="effort-ticks" aria-hidden="true">
            <i v-for="item in levels" :key="item" />
          </div>

          <Slider
            class="effort-slider"
            :model-value="[index]"
            :min="0"
            :max="maxIndex"
            :step="1"
            :aria-label="`思考强度：${label}`"
            @update:model-value="onSlide"
          />
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ChevronRight } from "@lucide/vue"
import { computed, ref } from "vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button } from "@components/ui/button/index.js"
import { Slider } from "@components/ui/slider/index.js"
import { displayThinkingLevel, formatThinkingLevel } from "@features/composer/lib/thinking-level.js"

const props = defineProps<{
  levels: readonly string[]
  level: string
}>()
const emit = defineEmits<{
  "update:level": [value: string]
}>()
const open = ref(false)
const current = computed(() => displayThinkingLevel(props.level, props.levels))
const label = computed(() => formatThinkingLevel(current.value))
const maxIndex = computed(() => Math.max(props.levels.length - 1, 0))
const index = computed(() => {
  const i = props.levels.indexOf(current.value)
  return i < 0 ? 0 : i
})
const effortMix = computed(() => {
  if (maxIndex.value <= 0) return 40
  return Math.round(28 + (index.value / maxIndex.value) * 72)
})

function setIndex(next: number) {
  const clamped = Math.min(maxIndex.value, Math.max(0, next))
  const level = props.levels[clamped]

  if (level && level !== current.value) emit("update:level", level)
}

function onSlide(value: number[] | undefined) {
  setIndex(value?.[0] ?? index.value)
}

function onWheel(event: WheelEvent) {
  const delta = event.deltaY || event.deltaX

  if (!delta) return
  setIndex(index.value + (delta > 0 ? 1 : -1))
}
</script>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
  min-width: 0;
  min-height: 0;
  height: auto;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-full);
  background: var(--hover-tint);
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.chip:hover {
  background: var(--hover-strong);
  color: var(--ink);
}

.chip:focus-visible {
  outline: var(--border-width) solid var(--primary);
  outline-offset: -2px;
}

.chip[data-state="open"] {
  background: var(--hover-strong);
  color: var(--ink);
}

.chip-caret {
  flex: none;
  width: 1em;
  height: 1em;
  transition: rotate var(--duration-fast) var(--ease-smooth);
}

.chip[data-state="open"] .chip-caret {
  rotate: 90deg;
}

.effort-pop {
  min-width: calc(var(--size-menu) * 1.6);
  padding: var(--spacing-sm);
}

.effort {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.effort-scale {
  display: flex;
  justify-content: space-between;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
}

.effort-bar {
  position: relative;
  display: flex;
  align-items: center;
  height: var(--spacing-xl);
}

.effort-ticks {
  position: absolute;
  inset-inline: var(--spacing-sm);
  inset-block: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.effort-ticks i {
  width: calc(var(--border-width) * 2);
  height: var(--spacing-xs);
  background: var(--effort-tick);
  border-radius: var(--radius-full);
}

.effort-slider {
  position: relative;
}

.effort-slider :deep([data-slot="slider-track"]) {
  height: calc(var(--spacing-md) + var(--spacing-xxs));
  overflow: hidden;
  background: var(--effort-track);
  border-radius: var(--radius-full);
}

.effort-slider :deep([data-slot="slider-range"]) {
  background-color: var(--effort-fill);
  transition:
    width var(--duration-slow) var(--ease-spring),
    background-color var(--duration-fast) var(--ease-out);
}

.effort-slider :deep([data-slot="slider-thumb"]) {
  z-index: 2;
  width: var(--spacing-sm);
  height: var(--spacing-lg);
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--effort-thumb);
  box-shadow: var(--shadow-soft);
  transition:
    inset-inline-start var(--duration-slow) var(--ease-spring),
    left var(--duration-slow) var(--ease-spring),
    background-color var(--duration-fast) var(--ease-out);
}

@media (prefers-reduced-motion: reduce) {
  .chip-caret,
  .effort-slider :deep([data-slot="slider-range"]),
  .effort-slider :deep([data-slot="slider-thumb"]) {
    transition: none;
  }
}
</style>
