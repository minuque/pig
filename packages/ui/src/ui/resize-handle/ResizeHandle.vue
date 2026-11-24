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
  inset-block: 0;
  inset-inline-start: 50%;
  inline-size: calc(var(--border-width) * 2);
  background: transparent;
  translate: -50% 0;
  transition: background-color var(--duration-fast) var(--ease-out);
}

:where([data-slot="resize-handle"][data-orientation="vertical"])::after {
  inset-block: 50% auto;
  inset-inline: 0;
  inline-size: auto;
  block-size: calc(var(--border-width) * 2);
  translate: 0 -50%;
}

:where([data-slot="resize-handle"]:hover)::after,
:where([data-slot="resize-handle"]:focus-visible)::after,
:where([data-slot="resize-handle"][data-dragging])::after {
  background: var(--focus-color);
}

:where([data-slot="resize-handle"]:focus-visible) {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="resize-handle"])::after {
    transition: none;
  }
}
</style>
