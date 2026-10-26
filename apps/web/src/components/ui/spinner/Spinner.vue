<template>
  <span class="rt-Spinner" :class="[sizeClass, props.class]" role="status" :aria-label="label">
    <span v-for="n in 8" :key="n" class="rt-SpinnerLeaf" />
  </span>
</template>

<script setup lang="ts">
import { computed, type HTMLAttributes } from "vue"

const props = withDefaults(
  defineProps<{
    /** 期望的像素尺寸，就近落到 Radix Themes 的三档（12 / 16 / 20） */
    size?: number
    /** 读屏名称 */
    label?: string
    class?: HTMLAttributes["class"]
  }>(),
  { size: 16, class: undefined },
)
const sizeClass = computed(() =>
  props.size <= 12 ? "rt-r-size-1" : props.size <= 16 ? "rt-r-size-2" : "rt-r-size-3",
)
</script>
