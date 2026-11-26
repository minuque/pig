<template>
  <SelectItemPrimitive :value="value" v-bind="$attrs">
    <slot />
  </SelectItemPrimitive>
</template>

<script setup lang="ts">
import { SelectItem as SelectItemPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })

defineProps<{ value: string }>()
</script>

<style>
:where([data-slot="select-item"]) {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  block-size: var(--control-sm);
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  outline: none;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  user-select: none;
  cursor: pointer;
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-item"]) {
  block-size: var(--space-lg);
  border-radius: var(--radius-min);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="select-item"][data-disabled]) {
  color: var(--fg-disabled);
  cursor: default;
}

:where([data-slot="select-item"][data-selected]:not([data-highlighted])) {
  background-color: var(--bg-selected);
  color: var(--fg);
}

:where([data-slot="select-content"][data-variant="solid"])
  :where([data-slot="select-item"][data-highlighted]) {
  background-color: var(--tone);
  color: var(--tone-on-solid);
}

:where([data-slot="select-content"][data-variant="soft"])
  :where([data-slot="select-item"][data-highlighted]) {
  background-color: var(--bg-hover);
}
</style>
