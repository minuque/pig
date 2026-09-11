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
      class="min-w-(--size-menu)"
      data-model-effort-menu
    >
      <DropdownMenuItem
        v-for="item in levels"
        :key="item"
        class="gap-(--spacing-xs) text-button"
        @select="onSelect($event, item)"
      >
        <span class="check-slot">
          <Check v-if="item === current" aria-hidden="true" />
        </span>
        {{ formatThinkingLevel(item) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Check, ChevronRight } from "@lucide/vue"
import { computed, ref } from "vue"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button } from "@components/ui/button/index.js"
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

function onSelect(event: Event, value: string) {
  event.preventDefault()
  emit("update:level", value)
  open.value = false
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

.check-slot {
  display: grid;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  place-items: center;
}

@media (prefers-reduced-motion: reduce) {
  .chip-caret {
    transition: none;
  }
}
</style>
