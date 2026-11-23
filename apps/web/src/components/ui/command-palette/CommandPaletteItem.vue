<template>
  <CommandItem :value="value" :disabled="disabled" @select="emit('select')">
    <span v-if="$slots.icon" data-slot="command-palette-item-icon"><slot name="icon" /></span>

    <span data-slot="command-palette-item-main">
      <span data-slot="command-palette-item-title"><slot /></span>

      <span v-if="$slots.description" data-slot="command-palette-item-description">
        <slot name="description" />
      </span>
    </span>

    <slot name="trailing" />
  </CommandItem>
</template>

<script setup lang="ts">
import { CommandItem } from "@ui-sdk/vue/command"

defineProps<{ value: string; disabled?: boolean }>()

const emit = defineEmits<{ select: [] }>()
</script>

<style>
:where([data-slot="command-item"]) {
  display: flex;
  min-height: var(--control-sm);
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

:where([data-slot="command-item"][data-highlighted]) {
  background: var(--bg-selected);
}

:where([data-slot="command-item"][data-disabled]) {
  cursor: default;
  opacity: var(--opacity-disabled);
}

:where([data-slot="command-palette-item-icon"]) {
  display: flex;
  height: 20px;
  flex: none;
  align-items: center;
  align-self: flex-start;
  color: var(--fg-secondary);
}

:where([data-slot="command-palette-item-main"]) {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

:where([data-slot="command-palette-item-title"]),
:where([data-slot="command-palette-item-description"]) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="command-palette-item-title"]) {
  line-height: 20px;
}

:where([data-slot="command-palette-item-description"]) {
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}
</style>
