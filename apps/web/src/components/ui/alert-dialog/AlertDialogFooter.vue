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
  /* 与面板内边距同档：按钮和上方说明之间留出同样的呼吸距离 */
  margin-block-start: var(--dialog-content-padding);
}

@media (min-width: 640px) {
  .aa-footer {
    flex-direction: row;
    justify-content: flex-end;
  }
}
</style>
