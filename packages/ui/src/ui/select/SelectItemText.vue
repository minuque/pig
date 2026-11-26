<template>
  <SelectItemTextPrimitive v-bind="$attrs">
    <slot />
  </SelectItemTextPrimitive>
</template>

<script setup lang="ts">
import { SelectItemText as SelectItemTextPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="select-item-text"]) {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="select-item-text"] mark) {
  background: transparent;
  color: inherit;
  font-weight: var(--font-weight-semibold);
}
</style>
