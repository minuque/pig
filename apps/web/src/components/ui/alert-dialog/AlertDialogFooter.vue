<template>
  <div
    data-slot="alert-dialog-footer"
    class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
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
