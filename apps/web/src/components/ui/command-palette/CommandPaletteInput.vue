<template>
  <div data-slot="command-palette-input">
    <SearchIcon class="size-icon lead" />
    <ListboxFilter v-model="model" class="input" auto-focus v-bind="$attrs" />
  </div>
</template>

<script setup lang="ts">
import { ListboxFilter } from "reka-ui"
import { SearchIcon } from "@components/icons/index.js"

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: "" })
</script>

<style scoped>
/* 输入框不画边框，和列表靠留白分开 */
[data-slot="command-palette-input"] {
  display: flex;
  flex: none;
  align-items: center;
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
}

.lead {
  flex: none;
  width: var(--space-2xl);
  color: var(--fg-secondary);
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
  color: var(--fg-secondary);
}
</style>
