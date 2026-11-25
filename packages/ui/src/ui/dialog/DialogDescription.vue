<template>
  <DialogDescriptionPrimitive v-bind="$attrs">
    <slot />
  </DialogDescriptionPrimitive>
</template>

<script setup lang="ts">
import { DialogDescription as DialogDescriptionPrimitive } from "@ui-sdk/vue/dialog"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="dialog-description"]) {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--fg-secondary);
  text-wrap: pretty;
}
</style>
