<template>
  <AlertDialogBackdrop class="glass-backdrop" />

  <AlertDialogContentPrimitive v-bind="$attrs" class="glass-panel">
    <slot />
  </AlertDialogContentPrimitive>
</template>

<script setup lang="ts">
import {
  AlertDialogBackdrop,
  AlertDialogContent as AlertDialogContentPrimitive,
} from "@ui-sdk/vue/alert-dialog"

defineOptions({ inheritAttrs: false })
</script>

<style>
:where([data-slot="alert-dialog-content"]) {
  position: fixed;
  inset: var(--space-md);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  block-size: fit-content;
  max-block-size: calc(100dvh - var(--space-md) * 2);
  max-inline-size: 32rem;
  min-height: 0;
  margin: auto;
  overflow: hidden;
}
</style>
