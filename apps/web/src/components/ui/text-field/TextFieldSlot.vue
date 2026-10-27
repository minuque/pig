<template>
  <div
    data-slot="text-field-slot"
    :data-accent-color="color"
    :data-side="side"
    class="rt-TextFieldSlot"
    :class="props.class"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"

const props = defineProps<{
  side?: "left" | "right"
  color?: string
  class?: HTMLAttributes["class"]
}>()
</script>
