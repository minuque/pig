<template>
  <h3 data-slot="popover-title" class="text-title font-semibold leading-none" :class="props.class">
    <slot />
  </h3>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
