<template>
  <span
    :class="{ 'word-reveal': delay !== null }"
    :style="delay === null ? undefined : { animationDelay: `${delay}ms` }"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { REVEAL_FADE_MS } from "@features/transcript-view/lib/response-reveal.js"

const props = defineProps<{ at: string | number }>()
const startsAt = Number(props.at)
const now = performance.now()
// 只在挂载时定延迟：重挂从原定时刻接着播，不会重播。
const delay = now >= startsAt + REVEAL_FADE_MS ? null : Math.round(startsAt - now)
</script>
