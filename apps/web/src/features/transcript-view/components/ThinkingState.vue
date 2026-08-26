<template>
  <span class="shimmer">{{ text }}</span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    text?: string
  }>(),
  { text: "思考中" },
)
</script>

<style scoped>
.shimmer {
  color: transparent;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: 18px;
  background: linear-gradient(
    90deg,
    var(--ink-faint) 0%,
    var(--ink-faint) 30%,
    color-mix(in srgb, var(--ink-faint) 45%, transparent) 45%,
    color-mix(in srgb, var(--ink-faint) 45%, transparent) 55%,
    var(--ink-faint) 70%,
    var(--ink-faint) 100%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: label-shine 2.25s cubic-bezier(0.25, 0.1, 0.25, 1) infinite;
}
@keyframes label-shine {
  0%,
  18% {
    background-position: 100% 0;
  }
  82%,
  100% {
    background-position: 0% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .shimmer {
    color: var(--ink-muted);
    background: none;
    -webkit-text-fill-color: currentColor;
    animation: none;
  }
}
</style>
