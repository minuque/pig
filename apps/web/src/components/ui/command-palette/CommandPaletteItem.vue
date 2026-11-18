<template>
  <ListboxItem
    data-slot="command-palette-item"
    :value="value"
    :disabled="disabled"
    @select="emit('select')"
  >
    <slot />
  </ListboxItem>
</template>

<script setup lang="ts">
import type { AcceptableValue } from "reka-ui"
import { ListboxItem } from "reka-ui"

defineProps<{ value: AcceptableValue; disabled?: boolean }>()

const emit = defineEmits<{ select: [] }>()
</script>

<style scoped>
[data-slot="command-palette-item"] {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
  border-radius: var(--radius-card);
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

[data-slot="command-palette-item"][data-highlighted] {
  background: var(--bg-emphasis);
}

[data-slot="command-palette-item"][data-disabled] {
  cursor: default;
  opacity: 0.5;
}

@media (prefers-reduced-motion: reduce) {
  [data-slot="command-palette-item"] {
    transition: none;
  }
}
</style>
