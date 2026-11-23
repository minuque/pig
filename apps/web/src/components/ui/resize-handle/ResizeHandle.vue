<template>
  <div class="resize-handle"></div>
</template>

<style scoped>
.resize-handle {
  position: relative;
  flex: none;
  cursor: ew-resize;
  touch-action: none;
}

.resize-handle[data-orientation="vertical"] {
  cursor: ns-resize;
}

.resize-handle::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline: calc(-1 * var(--space-2xs));
}

.resize-handle[data-orientation="vertical"]::before {
  inset-block: calc(-1 * var(--space-2xs));
  inset-inline: 0;
}

.resize-handle::after {
  content: "";
  position: absolute;
  top: 50%;
  inset-inline-start: 50%;
  inline-size: 3px;
  block-size: 40px;
  border-radius: var(--radius-pill);
  background: var(--scrollbar-color);
  opacity: 0;
  translate: -50% -50%;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    background-color var(--duration-fast) var(--ease-out);
}

.resize-handle[data-orientation="vertical"]::after {
  inline-size: 40px;
  block-size: 3px;
}

.resize-handle:hover::after,
.resize-handle:focus-visible::after,
.resize-handle[data-dragging]::after {
  opacity: 1;
}

.resize-handle:focus-visible {
  outline: none;
}

.resize-handle[data-dragging]::after {
  background: var(--fg-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .resize-handle::after {
    transition: none;
  }
}
</style>
