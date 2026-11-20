<template>
  <input
    type="radio"
    data-slot="radio"
    :data-accent-color="color"
    :data-size="size"
    :data-variant="variant"
    :value="value"
    :name="name"
    :disabled="disabled"
    :checked="checked"
    :class="props.class"
    @change="onChange"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { Size } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{
    /** 独立使用的单选按钮：脱离 RadioGroup 时用它自己成组（同名 group） */
    value: string
    name?: string
    checked?: boolean
    disabled?: boolean
    color?: string
    size?: Size
    variant?: "surface" | "soft"
    class?: HTMLAttributes["class"]
  }>(),
  { disabled: false, size: "m", variant: "surface", class: undefined },
)
const emit = defineEmits<{ "update:checked": [checked: boolean] }>()

function onChange(event: Event) {
  emit("update:checked", (event.target as HTMLInputElement).checked)
}
</script>

<style>
/* 独立的单选按钮：原生 input 去掉外观后，圆环与圆点都画在底色上 */
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

:where([data-slot="radio"]:disabled) {
  cursor: default;
}

/* --- surface --- */
:where([data-slot="radio"][data-variant="surface"]:not(:checked)) {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
}

:where([data-slot="radio"][data-variant="surface"]:checked) {
  background-color: var(--accent-indicator);
  background-image: radial-gradient(circle, var(--accent-contrast) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="surface"]:disabled) {
  background-color: var(--gray-a3);
  background-image: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
}

:where([data-slot="radio"][data-variant="surface"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--gray-a8) 0 20%, transparent 21%);
}

/* --- soft --- */
:where([data-slot="radio"][data-variant="soft"]) {
  background-color: var(--accent-a4);
  background-image: none;
  box-shadow: none;
}

:where([data-slot="radio"][data-variant="soft"]:checked) {
  background-image: radial-gradient(circle, var(--accent-a11) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="soft"]:disabled) {
  background-color: var(--gray-a3);
  background-image: none;
}

:where([data-slot="radio"][data-variant="soft"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--gray-a8) 0 20%, transparent 21%);
}
</style>
