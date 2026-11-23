<template>
  <div data-slot="resize-handle"></div>
</template>

<style>
:where([data-slot="resize-handle"]) {
  position: relative;
  flex: none;
  cursor: ew-resize;
  touch-action: none;
}

:where([data-slot="resize-handle"][data-orientation="vertical"]) {
  cursor: ns-resize;
}

:where([data-slot="resize-handle"])::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline: calc(-1 * var(--space-2xs));
}

:where([data-slot="resize-handle"][data-orientation="vertical"])::before {
  inset-block: calc(-1 * var(--space-2xs));
  inset-inline: 0;
}

:where([data-slot="resize-handle"])::after {
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

:where([data-slot="resize-handle"][data-orientation="vertical"])::after {
  inline-size: 40px;
  block-size: 3px;
}

:where([data-slot="resize-handle"]:hover)::after,
:where([data-slot="resize-handle"]:focus-visible)::after,
:where([data-slot="resize-handle"][data-dragging])::after {
  opacity: 1;
}

:where([data-slot="resize-handle"]:focus-visible) {
  outline: none;
}

:where([data-slot="resize-handle"][data-dragging])::after {
  background: var(--fg-secondary);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="resize-handle"])::after {
    transition: none;
  }
}
</style>
