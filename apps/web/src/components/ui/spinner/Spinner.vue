<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    size?: number
    class?: HTMLAttributes["class"]
  }>(),
  { size: 16, class: undefined },
)

const bars = [0, 1, 2, 3, 4]
const box = computed(() => `${props.size}px`)
const bar = computed(() => ({
  width: `${(props.size * 0.2).toFixed(2)}px`,
  height: `${(props.size * 0.075).toFixed(2)}px`,
}))
</script>

<template>
  <div class="relative" :class="props.class" :style="{ width: box, height: box }">
    <div
      v-for="i in bars"
      :key="i"
      class="absolute inset-0 flex animate-spin justify-center motion-reduce:animate-none"
      :style="{ animationDelay: `${i * 100}ms` }"
    >
      <div class="rounded-full bg-primary" :style="bar"></div>
    </div>
  </div>
</template>
