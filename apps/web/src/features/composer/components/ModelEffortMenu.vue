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
        <Check v-if="item === current" aria-hidden="true" />
        {{ formatThinkingLevel(item) }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Check } from "@lucide/vue"
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
</style>
