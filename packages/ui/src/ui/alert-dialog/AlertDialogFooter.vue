<template>
  <div data-slot="alert-dialog-footer" :class="props.class">
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>

<style>
:where([data-slot="alert-dialog-footer"]) {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  padding: var(--space-sm);
  border-block-start: var(--border-width) solid var(--glass-footer-border);
  background: var(--glass-footer-bg);
}
</style>
