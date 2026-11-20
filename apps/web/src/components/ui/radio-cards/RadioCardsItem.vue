<template>
  <RadioGroupItem data-slot="radio-cards-item" v-bind="forwarded" :class="props.class">
    <slot />
  </RadioGroupItem>
</template>

<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<RadioGroupItemProps>
</script>

<style>
/* 卡片项：内容居中、内部元素不参与指针事件；选中与焦点都画在同一圈描边上 */
:where([data-slot="radio-cards-item"]) {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  box-sizing: border-box;
  overflow: hidden;
  padding: 14px var(--space-md);
  border-radius: var(--radius-control);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-align: start;
  contain: paint;
  cursor: pointer;
}

:where([data-slot="radio-cards"][data-size="s"]) :where([data-slot="radio-cards-item"]) {
  padding: 10px var(--space-sm);
}

:where([data-slot="radio-cards"][data-size="l"]) :where([data-slot="radio-cards-item"]) {
  padding: 20px var(--space-lg);
  border-radius: var(--radius-card);
}

:where([data-slot="radio-cards-item"]) > * {
  pointer-events: none;
}

:where([data-slot="radio-cards-item"]) > :where(svg) {
  flex-shrink: 0;
}

:where([data-slot="radio-cards-item"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

:where([data-slot="radio-cards-item"][data-state="checked"]) {
  outline: 2px solid var(--tone);
  outline-offset: -2px;
}

:where([data-slot="radio-cards-item"]:focus-visible[data-state="checked"]) {
  outline-color: var(--focus-color);
}

:where([data-slot="radio-cards-item"]:disabled) {
  cursor: default;
  color: var(--fg-muted);
  background-image: linear-gradient(var(--bg-muted), var(--bg-muted));
}

:where([data-slot="radio-cards-item"]:disabled[data-state="checked"]) {
  outline-color: var(--border-input);
}

/* --- surface --- */
:where([data-slot="radio-cards"][data-variant="surface"]) :where([data-slot="radio-cards-item"]) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

@media (hover: hover) {
  :where([data-slot="radio-cards"][data-variant="surface"])
    :where([data-slot="radio-cards-item"]:not(:disabled):not([data-state="checked"]):hover) {
    box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
  }
}
</style>
