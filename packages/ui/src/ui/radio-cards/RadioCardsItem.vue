<template>
  <Radio data-radio-cards-item :value="value" :disabled="disabled" :class="props.class">
    <slot />
  </Radio>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Radio } from "@ui-sdk/vue/radio"

const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { disabled: false, class: undefined },
)
</script>

<style>
:where([data-radio-cards-item]) {
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

:where([data-radio-cards][data-size="s"]) :where([data-radio-cards-item]) {
  padding: 10px var(--space-sm);
}

:where([data-radio-cards][data-size="l"]) :where([data-radio-cards-item]) {
  padding: 20px var(--space-lg);
  border-radius: var(--radius-card);
}

:where([data-radio-cards-item]) > * {
  pointer-events: none;
}

:where([data-radio-cards-item]) > :where(svg) {
  flex-shrink: 0;
}

:where([data-radio-cards-item]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -2px;
}

:where([data-radio-cards-item][data-checked]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--tone);
}

:where([data-radio-cards-item][data-disabled]) {
  cursor: default;
  color: var(--fg-muted);
  background-image: linear-gradient(var(--bg-muted), var(--bg-muted));
}

:where([data-radio-cards-item][data-disabled][data-checked]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

:where([data-radio-cards][data-variant="surface"]) :where([data-radio-cards-item]) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border);
}

@media (hover: hover) {
  :where([data-radio-cards][data-variant="surface"])
    :where([data-radio-cards-item]:not([data-disabled], [data-checked]):hover) {
    box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
  }
}

:where([data-radio-cards][data-variant="surface"]) :where([data-radio-cards-item][data-checked]) {
  box-shadow: inset 0 0 0 var(--border-width) var(--tone);
}
</style>
