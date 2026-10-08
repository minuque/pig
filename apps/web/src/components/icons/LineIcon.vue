<template>
  <svg
    class="line-icon"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    <slot />
  </svg>
</template>

<style scoped>
.line-icon {
  display: block;
  flex: none;
  width: var(--size-icon);
  height: var(--size-icon);
  overflow: visible;
}

.line-icon :deep(*) {
  stroke: currentColor;
  stroke-width: var(--line-icon-width);
  stroke-linecap: round;
  stroke-linejoin: round;
  fill: none;
  vector-effect: non-scaling-stroke;
}

.line-icon :deep([fill]) {
  fill: currentColor;
  stroke: none;
}
</style>
