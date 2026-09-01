<template>
  <div class="tool-step-card" :class="{ 'is-thought': props.variant === 'thought' }">
    <slot />
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{ variant?: "tool" | "thought" }>(), {
  variant: "tool",
})
</script>

<style scoped>
.tool-step-card {
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
.tool-step-card.is-thought {
  padding: var(--spacing-sm);
}
</style>
