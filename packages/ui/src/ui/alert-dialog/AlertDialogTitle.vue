<template>
  <AlertDialogTitlePrimitive v-bind="$attrs">
    <slot />
  </AlertDialogTitlePrimitive>
</template>

<script setup lang="ts">
import { AlertDialogTitle as AlertDialogTitlePrimitive } from "@ui-sdk/vue/alert-dialog"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="alert-dialog-title"]) {
  flex: none;
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
  overflow-wrap: anywhere;
  text-wrap: balance;
}
</style>
