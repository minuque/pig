<template>
  <SelectSeparatorPrimitive v-bind="$attrs" />
</template>

<script setup lang="ts">
import { SelectSeparator as SelectSeparatorPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="select-separator"]) {
  block-size: 1px;
  margin-block: var(--space-xs);
  margin-inline: var(--space-sm);
  background-color: var(--bg-emphasis);
}
</style>
