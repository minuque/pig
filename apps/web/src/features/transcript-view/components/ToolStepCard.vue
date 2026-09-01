<template>
  <div class="tool-step-card">
    <slot />
  </div>
</template>

<style scoped>
.tool-step-card {
  overflow: hidden;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
}
</style>
