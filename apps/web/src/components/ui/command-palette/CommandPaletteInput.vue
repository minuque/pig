<template>
  <div data-slot="command-palette-input">
    <SearchIcon class="size-icon lead" />
    <ListboxFilter v-model="model" class="input" auto-focus v-bind="$attrs" />
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ListboxFilter } from "reka-ui"
import { SearchIcon } from "@components/icons/index.js"

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: "" })
</script>

<style scoped>
[data-slot="command-palette-input"] {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

[data-slot="command-palette-input"]:focus-within {
  box-shadow: inset var(--focus-ring);
}

.lead {
  flex: none;
  color: var(--fg-secondary);
}

.input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

.input::placeholder {
  color: var(--fg-faint);
}
</style>
