<template>
  <ScrollAreaScrollbarPrimitive :orientation="orientation">
    <ScrollAreaThumb />
  </ScrollAreaScrollbarPrimitive>
</template>

<script setup lang="ts">
import {
  ScrollAreaScrollbar as ScrollAreaScrollbarPrimitive,
  ScrollAreaThumb,
} from "@ui-sdk/vue/scroll-area"

withDefaults(defineProps<{ orientation?: "vertical" | "horizontal" }>(), {
  orientation: "vertical",
})
</script>

<style>
:where([data-slot="scroll-area"]) {
  position: relative;
}

:where([data-slot="scroll-area-scrollbar"]) {
  display: flex;
  padding: 2px;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

:where([data-slot="scroll-area-scrollbar"][data-visible]) {
  opacity: 1;
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="vertical"]) {
  flex-direction: column;
  inline-size: var(--scrollbar-size);
}

:where([data-slot="scroll-area-scrollbar"][data-orientation="horizontal"]) {
  block-size: var(--scrollbar-size);
}

:where([data-slot="scroll-area-thumb"]) {
  position: relative;
  border-radius: var(--radius-pill);
  background: var(--scrollbar-thumb);
}

@media (prefers-reduced-motion: reduce) {
  :where([data-slot="scroll-area-scrollbar"]) {
    transition: none;
  }
}
</style>
