<template>
  <div data-slot="alert-dialog-header" class="aa-header" :class="props.class">
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>

<style scoped>
.aa-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  text-align: center;
}

@media (min-width: 640px) {
  .aa-header {
    text-align: start;
  }
}
</style>
