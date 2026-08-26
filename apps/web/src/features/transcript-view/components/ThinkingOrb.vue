<template>
  <span
    class="orb"
    role="img"
    :aria-label="label"
    :style="{ width: `${size}px`, height: `${size}px`, '--orb-k': size / STAGE }"
  >
    <span class="ring">
      <span
        v-for="dot in dots"
        :key="dot.key"
        class="dot"
        :style="{
          '--orb-rx': `${dot.rx}px`,
          '--orb-ry': `${dot.ry}px`,
          animationDelay: `${dot.delay}ms`,
        }"
      />
    </span>
  </span>
</template>

<script setup lang="ts">
const STAGE = 28
const RING_N = 8
const RING_R = 8
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
    label?: string
  }>(),
  { size: 16, label: "思考中" },
)
</script>

<style scoped>
.orb {
  position: relative;
  display: block;
  flex: none;
  overflow: hidden;
  color: var(--ink-muted);
  contain: strict;
}
.ring {
  position: absolute;
  inset: 0;
  transform: scale(var(--orb-k, 1));
}
.dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 3px;
  height: 3px;
  margin: -1.5px 0 0 -1.5px;
  border-radius: var(--radius-full);
  background: currentColor;
  animation: orb-ring-pulse 2s ease-in-out infinite both;
}
@keyframes orb-ring-pulse {
  0%,
  100% {
    opacity: 0.18;
    transform: translate(var(--orb-rx), var(--orb-ry)) scale(0.7);
  }
  50% {
    opacity: 1;
    transform: translate(var(--orb-rx), var(--orb-ry)) scale(1.15);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
    opacity: 0.7;
    transform: translate(var(--orb-rx), var(--orb-ry));
  }
}
</style>
