<template>
  <div
    data-slot="alert-dialog-header"
    class="flex flex-col gap-(--spacing-xs) text-center sm:text-start"
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
