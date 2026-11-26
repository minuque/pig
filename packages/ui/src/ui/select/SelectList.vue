<template>
  <SelectListPrimitive v-bind="$attrs">
    <template v-if="$slots.default" #default="slotProps">
      <slot v-bind="slotProps" />
    </template>
  </SelectListPrimitive>
</template>

<script setup lang="ts">
import { SelectList as SelectListPrimitive, type SelectContentState } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })

defineSlots<{ default?: (props: { state: SelectContentState }) => unknown }>()
</script>

<style>
:where([data-slot="select-list"]) {
  box-sizing: border-box;
  flex: 1;
  min-block-size: 0;
  padding: var(--space-2xs);
  overflow-y: auto;
  overscroll-behavior: contain;
  scroll-padding-block: var(--space-2xs);
}

:where([data-slot="select-list"]) > * + * {
  margin-block-start: var(--menu-item-gap);
}

:where([data-slot="select-list"]:not(:has([data-slot="select-item"]:not([hidden])))) {
  padding: 0;
}
</style>
