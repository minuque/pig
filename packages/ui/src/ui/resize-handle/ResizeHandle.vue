<template>
  <div data-slot="resizable-handle"></div>
</template>

<style>
:where([data-slot="resizable-handle"]) {
  position: relative;
}

:where([data-slot="resizable-handle"]:focus-visible) {
  outline: none;
}

:where([data-slot="resizable-handle"])::after {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-start: 50%;
  inline-size: calc(var(--border-width) * 2);
  background: transparent;
  translate: -50% 0;
  transition: background-color var(--duration-fast) var(--ease-out);
}

:where([data-slot="resizable-handle"][data-orientation="vertical"])::after {
  inset-block: 50% auto;
  inset-inline: 0;
  inline-size: auto;
  block-size: calc(var(--border-width) * 2);
  translate: 0 -50%;
}

:where([data-slot="resizable-handle"][data-hovering])::after,
:where([data-slot="resizable-handle"][data-dragging])::after,
:where([data-slot="resizable-handle"]:focus-visible)::after {
  background: var(--focus-color);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="resizable-handle"])::after {
    transition: none;
  }
}
</style>
