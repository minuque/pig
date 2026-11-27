<template>
  <div data-slot="command-palette-input">
    <SearchIcon class="size-icon-lg" data-slot="command-palette-lead" />
    <CommandInput :aria-label="placeholder" :placeholder="placeholder" />
  </div>
</template>

<script setup lang="ts">
import { CommandInput } from "@ui-sdk/vue/command"
import { SearchIcon } from "@lucide/vue"

defineProps<{ placeholder: string }>()
</script>

<style>
:where([data-slot="command-palette-input"]) {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  padding: calc(var(--spacing) * 1.5) calc(var(--space-xs) * 2);
}

:where([data-slot="command-palette-input"] > [data-slot="command-palette-lead"]) {
  flex: none;
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
