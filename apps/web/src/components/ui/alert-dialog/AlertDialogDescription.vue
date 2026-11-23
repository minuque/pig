<template>
  <AlertDialogDescriptionPrimitive v-bind="$attrs">
    <slot />
  </AlertDialogDescriptionPrimitive>
</template>

<script setup lang="ts">
import { AlertDialogDescription as AlertDialogDescriptionPrimitive } from "@ui-sdk/vue/alert-dialog"

defineOptions({ inheritAttrs: false })
</script>

<style scoped>
[data-slot="alert-dialog-description"] {
  max-height: min(24rem, 60dvh);
  min-height: 0;
  margin: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--fg-secondary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  overflow-wrap: anywhere;
  user-select: text;
}
</style>
