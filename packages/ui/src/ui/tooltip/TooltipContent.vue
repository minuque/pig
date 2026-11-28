<template>
  <TooltipContentPrimitive
    :side-offset="4"
    :collision-padding="10"
    v-bind="$attrs"
    class="reveal-menu"
    :class="props.class"
  >
    <p data-slot="tooltip-text">
      <slot />
      <TooltipShortcut v-if="shortcut" data-slot="tooltip-shortcut" />
    </p>

    <TooltipArrow />
  </TooltipContentPrimitive>
</template>

<script setup lang="ts">
import { inject, type HTMLAttributes } from "vue"
import {
  TooltipArrow,
  TooltipContent as TooltipContentPrimitive,
  TooltipShortcut,
} from "@ui-sdk/vue/tooltip"
import { tooltipShortcutKey } from "./shortcut-key.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const shortcut = inject(tooltipShortcutKey, undefined)
</script>

<style>
:where([data-slot="tooltip-content"]) {
  box-sizing: border-box;
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-control);
  background-color: var(--fg);
  transform-origin: var(--transform-origin);
}

:where([data-slot="tooltip-text"]) {
  margin: 0;
  max-inline-size: min(36rem, var(--popup-available-width, 90vw));
  color: var(--tooltip-fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  overflow-wrap: anywhere;
  user-select: none;
  cursor: default;
}

:where([data-slot="tooltip-shortcut"]) {
  margin-inline-start: var(--space-2xs);
  color: var(--tooltip-fg-muted);
  font-variant-numeric: tabular-nums;
}

:where([data-slot="tooltip-arrow"]) {
  inline-size: 10px;
  block-size: 5px;
  background-color: var(--fg);
}

:where([data-slot="tooltip-arrow"][data-side="top"]) {
  inset-block-start: calc(100% - 1px);
  clip-path: polygon(0 0, 100% 0, 100% 1px, 50% 100%, 0 1px);
}

:where([data-slot="tooltip-arrow"][data-side="bottom"]) {
  inset-block-end: calc(100% - 1px);
  clip-path: polygon(50% 0, 100% calc(100% - 1px), 100% 100%, 0 100%, 0 calc(100% - 1px));
}

:where([data-slot="tooltip-arrow"]:is([data-side="left"], [data-side="right"])) {
  inline-size: 5px;
  block-size: 10px;
}

:where([data-slot="tooltip-arrow"][data-side="left"]) {
  left: calc(100% - 1px);
  clip-path: polygon(0 0, 1px 0, 100% 50%, 1px 100%, 0 100%);
}

:where([data-slot="tooltip-arrow"][data-side="right"]) {
  right: calc(100% - 1px);
  clip-path: polygon(calc(100% - 1px) 0, 100% 0, 100% 100%, calc(100% - 1px) 100%, 0 50%);
}
</style>
