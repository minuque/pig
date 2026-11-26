<template>
  <SelectTriggerPrimitive
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    v-bind="$attrs"
    :class="props.class"
  >
    <span data-slot="select-trigger-inner">
      <SelectValue :placeholder="placeholder"><slot /></SelectValue>
    </span>

    <span data-slot="select-icon">
      <ChevronDownIcon />
    </span>
  </SelectTriggerPrimitive>
</template>

<script setup lang="ts">
import type { ToneColor, Radius } from "../../core/types.js"
import type { HTMLAttributes } from "vue"
import { SelectTrigger as SelectTriggerPrimitive, SelectValue } from "@ui-sdk/vue/select"
import { useSelectSize } from "./select-context.js"
import { ChevronDownIcon } from "@lucide/vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    variant?: "surface" | "ghost"
    color?: ToneColor
    radius?: Radius
    placeholder?: string
  }>(),
  { class: undefined, variant: "surface", placeholder: "" },
)
const size = useSelectSize()
</script>

<style>
:where([data-slot="select-trigger"]) {
  box-sizing: border-box;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: var(--space-xs);
  height: var(--control-md);
  padding-inline: calc(var(--spacing) * 3 - var(--border-width));
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-control);
  color: var(--fg);
  font-family: var(--font-sans);
  font-size: var(--text-body);
  font-style: normal;
  font-weight: var(--font-weight-normal);
  line-height: var(--text-body--line-height);
  text-align: start;
  white-space: nowrap;
  vertical-align: top;
  user-select: none;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

:where([data-slot="select-trigger"][data-size="s"]) {
  gap: calc(var(--spacing) * 1.5);
  height: var(--control-sm);
  padding-inline: calc(var(--spacing) * 2.5 - var(--border-width));
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="select-trigger"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="select-trigger"][data-disabled]) {
  opacity: var(--opacity-disabled);
  pointer-events: none;
}

:where([data-slot="select-trigger-inner"]) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:where([data-slot="select-icon"]) {
  display: inline-flex;
  flex-shrink: 0;
  margin-inline-end: calc(var(--spacing) * -1);
  color: var(--fg-muted);
}

:where([data-slot="select-icon"]) :where(svg) {
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
}

:where([data-slot="select-trigger"][data-placeholder]) :where([data-slot="select-trigger-inner"]) {
  color: var(--fg-muted);
}

:where([data-slot="select-trigger"][data-variant="surface"]) {
  border-color: var(--control-border);
  background-color: var(--control-bg);
  background-clip: padding-box;
  box-shadow: var(--control-shadow);
}

:where([data-slot="select-trigger"][data-variant="ghost"]) {
  color: var(--fg-secondary);
}

@media (hover: hover) {
  :where([data-slot="select-trigger"][data-variant="ghost"]:hover) {
    background-color: var(--bg-hover);
    color: var(--fg);
  }
}

:where([data-slot="select-trigger"][data-variant="ghost"][data-open]) {
  background-color: var(--bg-hover);
  color: var(--fg);
}
</style>
