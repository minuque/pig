<template>
  <span v-if="text" class="spinner" :class="props.class">
    <Loader :size="size" class="animate-spin motion-reduce:animate-none" />
    <span class="shimmer">{{ text }}</span>
  </span>
  <Loader
    v-else
    :size="size"
    class="animate-spin motion-reduce:animate-none"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Loader } from "@lucide/vue"

const props = withDefaults(
  defineProps<{
    size?: number
    class?: HTMLAttributes["class"]
    text?: string
  }>(),
  { size: 16, class: undefined, text: "" },
)
</script>

<style scoped>
.spinner {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
}
</style>
