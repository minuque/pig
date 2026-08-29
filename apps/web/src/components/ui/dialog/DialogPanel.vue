<template>
  <div
    data-slot="dialog-panel"
    class="min-h-0 overflow-y-auto overscroll-contain"
    :class="props.class"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
