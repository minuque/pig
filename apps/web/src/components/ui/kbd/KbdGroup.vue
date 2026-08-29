<template>
  <span data-slot="kbd-group" class="inline-flex items-center gap-1" :class="props.class">
    <slot />
  </span>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
