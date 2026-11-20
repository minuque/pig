<template>
  <ListboxItem
    data-slot="command-palette-item"
    :value="value"
    :disabled="disabled"
    @select="emit('select')"
  >
    <span v-if="$slots.icon" class="icon"><slot name="icon" /></span>

    <span class="main">
      <span class="title"><slot /></span>
      <span v-if="$slots.description" class="description"><slot name="description" /></span>
    </span>

    <slot name="trailing" />
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
  min-height: 28px;
  align-items: center;
  gap: var(--space-xs);
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
  border-radius: calc(var(--radius-control) - 2px);
  color: var(--fg);
  font-size: var(--text-body);
  outline: none;
  cursor: pointer;
  user-select: none;
}

[data-slot="command-palette-item"][data-highlighted] {
  background: var(--bg-selected);
}

[data-slot="command-palette-item"][data-disabled] {
  cursor: default;
  opacity: var(--opacity-disabled);
}

.icon {
  display: flex;
  height: 20px;
  flex: none;
  align-items: center;
  align-self: flex-start;
  color: var(--fg-secondary);
}

.main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.title,
.description {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  line-height: 20px;
}

.description {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}
</style>
