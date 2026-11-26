<template>
  <SelectEmptyPrimitive v-bind="$attrs">
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SelectEmptyPrimitive>
</template>

<script setup lang="ts">
import { SelectEmpty as SelectEmptyPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="select-empty"]) {
  margin: 0;
  padding: var(--space-md) var(--space-sm);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: center;
}

:where([data-slot="select-empty"]:not([data-empty])) {
  display: none;
}
</style>
