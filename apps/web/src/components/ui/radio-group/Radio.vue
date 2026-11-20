<template>
  <input
    type="radio"
    data-slot="radio"
    :data-tone="color"
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
import type { Size, ToneColor } from "@/types/ui-type.js"

const props = withDefaults(
  defineProps<{
    /** 独立使用的单选按钮：脱离 RadioGroup 时用它自己成组（同名 group） */
    value: string
    name?: string
    checked?: boolean
    disabled?: boolean
    color?: ToneColor
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
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

:where([data-slot="radio"][data-variant="surface"]:checked) {
  background-color: var(--tone);
  background-image: radial-gradient(circle, var(--fg-on-accent) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="surface"]:disabled) {
  background-color: var(--bg-muted);
  background-image: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="radio"][data-variant="surface"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--fg-disabled) 0 20%, transparent 21%);
}

/* --- soft --- */
:where([data-slot="radio"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  background-image: none;
  box-shadow: none;
}

:where([data-slot="radio"][data-variant="soft"]:checked) {
  background-image: radial-gradient(circle, var(--tone-text) 0 20%, transparent 21%);
}

:where([data-slot="radio"][data-variant="soft"]:disabled) {
  background-color: var(--bg-muted);
  background-image: none;
}

:where([data-slot="radio"][data-variant="soft"]:disabled:checked) {
  background-image: radial-gradient(circle, var(--fg-disabled) 0 20%, transparent 21%);
}
</style>
