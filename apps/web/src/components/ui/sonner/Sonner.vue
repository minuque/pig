<script setup lang="ts">
import { Toaster as Sonner } from "vue-sonner";
import "vue-sonner/style.css";
</script>

<template>
  <Sonner
    class="toaster group"
    position="top-right"
    close-button
    close-button-position="top-right"
    rich-colors
    :duration="5000"
    :style="{
      '--normal-bg': 'var(--surface)',
      '--normal-bg-hover': 'var(--canvas-soft)',
      '--normal-text': 'var(--ink)',
      '--normal-border': 'var(--hairline)',
      '--border-radius': 'var(--radius-md)',
      '--error-bg': 'color-mix(in srgb, var(--danger) 18%, var(--surface))',
      '--error-border': 'color-mix(in srgb, var(--danger) 55%, var(--hairline))',
      '--error-text': 'var(--ink)',
      '--gray2': 'var(--canvas-soft)',
      '--gray4': 'var(--hairline)',
      '--gray5': 'var(--hairline)',
      '--gray12': 'var(--ink-muted)',
    }"
  />
</template>

<style scoped>
.toaster :deep([data-sonner-toast][data-styled="true"]) {
  padding-right: 36px;
}
.toaster :deep([data-sonner-toast][data-type="error"] [data-icon]) {
  color: var(--danger);
}
.toaster :deep([data-sonner-toast] [data-close-button]),
.toaster :deep([data-sonner-toast][data-type="error"] [data-close-button]) {
  left: auto;
  right: 8px;
  top: 8px;
  bottom: auto;
  transform: none;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
}
.toaster :deep([data-sonner-toast]:hover [data-close-button]:hover) {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border-color: transparent;
  color: var(--ink);
}
</style>
