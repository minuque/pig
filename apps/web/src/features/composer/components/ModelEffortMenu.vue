<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
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
      <div class="effort" @pointerdown.stop>
        <p class="effort-title">思考强度 {{ label }}</p>

        <div class="effort-scale">
          <span>更快</span>
          <span>更强</span>
        </div>

        <div class="effort-bar">
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

function onSlide(value: number[] | undefined) {
  const next = props.levels[value?.[0] ?? -1]

  if (next) emit("update:level", next)
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
  min-width: calc(var(--size-menu) + var(--size-control));
  padding: var(--spacing-sm);
}

.effort {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.effort-title {
  margin: 0;
  color: var(--ink);
  font-size: var(--text-button);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-button--line-height);
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
  height: var(--size-icon-button);
}

.effort-ticks {
  position: absolute;
  inset-inline: calc(var(--size-icon) / 2);
  inset-block: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}

.effort-ticks i {
  width: var(--border-width);
  height: var(--spacing-xs);
  background: var(--ink-faint);
  border-radius: var(--radius-full);
}

.effort-slider {
  position: relative;
  z-index: 1;
}

@media (prefers-reduced-motion: reduce) {
  .chip-caret {
    transition: none;
  }
}
</style>
