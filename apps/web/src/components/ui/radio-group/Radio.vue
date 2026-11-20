<template>
  <input
    type="radio"
    data-slot="radio"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :data-high-contrast="highContrast || undefined"
    :value="value"
    :name="name"
    :disabled="disabled"
    :checked="checked"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size } from "@components/ui/rt/size.js"

const props = withDefaults(
  defineProps<{
    value: string
    name?: string
    checked?: boolean
    disabled?: boolean
    color?: string
    size?: Size
    variant?: "classic" | "surface" | "soft"
    highContrast?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { disabled: false, size: "m", variant: "surface", highContrast: false, class: undefined },
)
const emit = defineEmits<{ "update:checked": [checked: boolean] }>()

function onChange(event: Event) {
  emit("update:checked", (event.target as HTMLInputElement).checked)
}
</script>

<style>
:where([data-slot="radio"]) {
  appearance: none;
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  vertical-align: top;
  inline-size: var(--space-md);
  block-size: var(--space-md);
  border-radius: 100%;
  cursor: pointer;
}

:where([data-slot="radio"][data-size="s"]) {
  inline-size: calc(var(--space-md) * 0.875);
  block-size: calc(var(--space-md) * 0.875);
}

:where([data-slot="radio"][data-size="l"]) {
  inline-size: calc(var(--space-md) * 1.25);
  block-size: calc(var(--space-md) * 1.25);
}

:where([data-slot="radio"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="radio"][data-disabled]) {
  cursor: default;
}

:where([data-slot="radio"][data-variant="surface"]:not(:checked)) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
}

:where([data-slot="radio"][data-variant="surface"]:checked) {
  background-color: var(--accent-indicator);
  background-image: radial-gradient(circle, var(--accent-contrast) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="surface"]:checked[data-high-contrast]) {
  background-color: var(--accent-12);
  background-image: radial-gradient(circle, var(--accent-1) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="surface"]:disabled) {
  background-color: var(--gray-a3);
  background-image: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
}

:where([data-slot="radio"][data-variant="surface"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--gray-a8) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="classic"]:not(:checked)) {
  background-color: var(--bg-raised);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-7),
    0 1px 2px var(--black-a1);
}

:where([data-slot="radio"][data-variant="classic"]:checked) {
  background-color: var(--accent-indicator);
  background-image: radial-gradient(circle, var(--accent-contrast) 0 20%, transparent 21%);
  box-shadow:
    inset 0 0.5px 0.5px var(--white-a4),
    inset 0 -0.5px 0.5px var(--black-a4);
}

:where([data-slot="radio"][data-variant="classic"]:checked[data-high-contrast]) {
  background-color: var(--accent-12);
  background-image: radial-gradient(circle, var(--accent-1) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="classic"]:disabled) {
  background-color: var(--gray-a3);
  background-image: none;
  box-shadow: 0 1px 2px var(--black-a1);
}

:where([data-slot="radio"][data-variant="classic"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--gray-a8) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="soft"]) {
  background-color: var(--accent-a4);
  background-image: none;
  box-shadow: none;
}

:where([data-slot="radio"][data-variant="soft"]:checked) {
  background-image: radial-gradient(circle, var(--accent-a11) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="soft"]:checked[data-high-contrast]) {
  background-image: radial-gradient(circle, var(--accent-12) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="soft"]:focus-visible) {
  outline-color: var(--accent-8);
}

:where([data-slot="radio"][data-variant="soft"]:disabled) {
  background-color: var(--gray-a3);
  background-image: none;
}

:where([data-slot="radio"][data-variant="soft"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--gray-a8) 0 20%, transparent 21%);
}
</style>
