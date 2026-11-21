<template>
  <div data-slot="text-field-slot" :data-tone="color" :data-side="side" :class="props.class">
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { ToneColor } from "@/types/ui-type.js"
import type { HTMLAttributes } from "vue"

const props = defineProps<{
  side?: "left" | "right"
  color?: ToneColor
  class?: HTMLAttributes["class"]
}>()
</script>
