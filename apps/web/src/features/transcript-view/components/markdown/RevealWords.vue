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
const delay = now >= startsAt + REVEAL_FADE_MS ? null : Math.round(startsAt - now)
</script>
