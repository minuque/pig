<template>
  <DialogTitlePrimitive v-bind="$attrs">
    <slot />
  </DialogTitlePrimitive>
</template>

<script setup lang="ts">
import { DialogTitle as DialogTitlePrimitive } from "@ui-sdk/vue/dialog"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="dialog-title"]) {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
  color: var(--fg);
  text-wrap: balance;
}
</style>
