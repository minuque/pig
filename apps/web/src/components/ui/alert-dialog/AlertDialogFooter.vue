<template>
  <div data-slot="alert-dialog-footer" class="aa-footer" :class="props.class">
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
.aa-footer {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-xs);
}

@media (min-width: 640px) {
  .aa-footer {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
