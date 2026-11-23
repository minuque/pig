<template>
  <div data-slot="command-palette-input">
    <SearchIcon class="size-icon" data-slot="command-palette-lead" />
    <CommandInput :aria-label="placeholder" :placeholder="placeholder" />
  </div>
</template>

<script setup lang="ts">
import { CommandInput } from "@ui-sdk/vue/command"
import { SearchIcon } from "@components/icons/index.js"

defineProps<{ placeholder: string }>()
</script>

<style>
:where([data-slot="command-palette-input"]) {
  display: flex;
  flex: none;
  align-items: center;
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
}

[data-slot="command-palette-input"] > [data-slot="command-palette-lead"] {
  flex: none;
  inline-size: var(--space-2xl);
  color: var(--fg-muted);
}

:where([data-slot="command-input"]) {
  min-width: 0;
  height: calc(var(--spacing) * 8.5);
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: var(--text-body);
}

:where([data-slot="command-input"])::placeholder {
  color: var(--fg-muted);
}
</style>
