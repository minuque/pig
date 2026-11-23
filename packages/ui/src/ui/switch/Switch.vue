<template>
  <SwitchRoot
    v-bind="modelValue === undefined ? {} : { checked: modelValue }"
    :disabled="disabled"
    :data-tone="color"
    :data-size="size"
    :class="props.class"
    @checked-change="(next: boolean) => emit('update:modelValue', next)"
  >
    <SwitchThumb />
  </SwitchRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Switch as SwitchRoot, SwitchThumb } from "@ui-sdk/vue/switch"
import type { Size, ToneColor } from "../../core/types.js"

const props = withDefaults(
  defineProps<{
    modelValue?: boolean | undefined
    disabled?: boolean
    class?: HTMLAttributes["class"]
    size?: Size
    color?: ToneColor
  }>(),
  {
    modelValue: undefined,
    disabled: false,
    class: undefined,
    size: "m",
  },
)
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>()
</script>

<style>
:where([data-slot="switch"]) {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  vertical-align: top;
  padding: 2px;
  border-radius: var(--radius-pill);
  background-color: var(--border-input);
  cursor: pointer;
  transition:
    background-color var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
}

:where([data-slot="switch"][data-checked]) {
  background-color: var(--tone);
}

:where([data-slot="switch"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="switch"][data-disabled]) {
  opacity: var(--opacity-disabled);
  cursor: not-allowed;
}

:where([data-slot="switch-thumb"]) {
  display: block;
  flex-shrink: 0;
  border-radius: var(--radius-pill);
  background-color: var(--bg);
  box-shadow: 0 1px 2px var(--thumb-shadow);
  pointer-events: none;
  transform-origin: left center;
  transition: transform var(--duration-fast) var(--ease-out);
}

:where([data-slot="switch-thumb"][data-checked]) {
  transform-origin: right center;
}

:where([data-slot="switch-thumb"][data-unchecked]) {
  background-color: var(--switch-thumb-unchecked);
}

:where([data-slot="switch"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-unchecked]) {
  transform: scaleX(1.1);
}

:where([data-slot="switch"][data-size="s"]) {
  inline-size: calc(calc(var(--spacing) * 3.5) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 3.5) + 2px);
}

:where([data-slot="switch"][data-size="s"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 3.5) - 2px);
  block-size: calc(calc(var(--spacing) * 3.5) - 2px);
}

:where([data-slot="switch"][data-size="s"]) :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 3.5) - 4px));
}

:where([data-slot="switch"][data-size="s"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 3.5) - 4px)) scaleX(1.1);
}

:where([data-slot="switch"][data-size="m"]) {
  inline-size: calc(calc(var(--spacing) * 4) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 4) + 2px);
}

:where([data-slot="switch"][data-size="m"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 4) - 2px);
  block-size: calc(calc(var(--spacing) * 4) - 2px);
}

:where([data-slot="switch"][data-size="m"]) :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 4) - 4px));
}

:where([data-slot="switch"][data-size="m"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 4) - 4px)) scaleX(1.1);
}

:where([data-slot="switch"][data-size="l"]) {
  inline-size: calc(calc(var(--spacing) * 5) * 2 - 2px);
  block-size: calc(calc(var(--spacing) * 5) + 2px);
}

:where([data-slot="switch"][data-size="l"]) :where([data-slot="switch-thumb"]) {
  inline-size: calc(calc(var(--spacing) * 5) - 2px);
  block-size: calc(calc(var(--spacing) * 5) - 2px);
}

:where([data-slot="switch"][data-size="l"]) :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 5) - 4px));
}

:where([data-slot="switch"][data-size="l"]:active:not([data-disabled]))
  :where([data-slot="switch-thumb"][data-checked]) {
  transform: translateX(calc(calc(var(--spacing) * 5) - 4px)) scaleX(1.1);
}
</style>
