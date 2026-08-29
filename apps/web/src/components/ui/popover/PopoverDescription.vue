<template>
  <p
    data-slot="popover-description"
    class="text-body-md text-muted-foreground"
    :class="props.class"
  >
    <slot />
  </p>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
</script>
