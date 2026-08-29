<template>
  <div
    data-slot="alert-action"
    class="flex shrink-0 items-center gap-1 self-center"
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
