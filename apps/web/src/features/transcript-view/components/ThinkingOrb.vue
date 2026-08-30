<template>
  <svg class="orb" :width="size" :height="size" :viewBox="`0 0 ${STAGE} ${STAGE}`">
    <circle
      v-for="dot in dots"
      :key="dot.key"
      class="dot"
      :cx="CENTER + dot.rx"
      :cy="CENTER + dot.ry"
      :r="DOT_R"
      :style="{ animationDelay: `${dot.delay}ms` }"
    />
  </svg>
</template>

<script setup lang="ts">
const STAGE = 28
const CENTER = STAGE / 2
const RING_N = 8
const RING_R = 10
const DOT_R = 2
const RING_MS = 2000

const dots = Array.from({ length: RING_N }, (_, i) => {
  const angle = (i / RING_N) * Math.PI * 2 - Math.PI / 2
  return {
    key: i,
    rx: Math.cos(angle) * RING_R,
    ry: Math.sin(angle) * RING_R,
    delay: -((RING_N - 1 - i) / RING_N) * RING_MS,
  }
})

withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 20 },
)
</script>

<style scoped>
.orb {
  display: block;
  flex: none;
  overflow: visible;
  border: 0;
  outline: none;
  fill: currentColor;
  color: var(--ink-muted);
  pointer-events: none;
}
.dot {
  transform-box: fill-box;
  transform-origin: center;
  animation: orb-ring-pulse 2s ease-in-out infinite both;
}
@keyframes orb-ring-pulse {
  0%,
  100% {
    opacity: 0.18;
    transform: scale(0.7);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
    opacity: 0.7;
  }
}
</style>
