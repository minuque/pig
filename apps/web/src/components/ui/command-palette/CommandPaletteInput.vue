<template>
  <div data-slot="command-palette-input">
    <SearchIcon class="size-icon lead" />
    <CommandInput class="input" :aria-label="placeholder" :placeholder="placeholder" />
  </div>
</template>

<script setup lang="ts">
import { CommandInput } from "@ui-sdk/vue/command"
import { SearchIcon } from "@components/icons/index.js"

defineProps<{ placeholder: string }>()
</script>

<style scoped>
[data-slot="command-palette-input"] {
  display: flex;
  flex: none;
  align-items: center;
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
}

.lead {
  flex: none;
  width: var(--space-2xl);
  color: var(--fg-muted);
}

.input {
  min-width: 0;
  height: calc(var(--spacing) * 8.5);
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: var(--text-body);
}

.input::placeholder {
  color: var(--fg-muted);
}
</style>
