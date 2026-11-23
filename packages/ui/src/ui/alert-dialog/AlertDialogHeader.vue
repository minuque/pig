<template>
  <div data-slot="alert-dialog-header" :class="props.class">
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
:where([data-slot="alert-dialog-header"]) {
  display: flex;
  min-height: 0;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-lg);
}
</style>
