<template>
  <SelectGroupLabel v-bind="$attrs">
    <slot />
  </SelectGroupLabel>
</template>

<script setup lang="ts">
import { SelectGroupLabel } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="select-group-label"]) {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  block-size: var(--control-md);
  padding-inline: var(--space-sm);
  color: var(--fg-muted);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  user-select: none;
  cursor: default;
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-group-label"]) {
  block-size: var(--space-lg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}
</style>
