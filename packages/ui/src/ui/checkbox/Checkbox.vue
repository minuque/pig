<template>
  <CheckboxRoot
    v-bind="modelValue === undefined ? {} : { checked: modelValue }"
    :disabled="disabled"
    :data-tone="color ?? 'accent'"
    :data-size="size"
    :data-variant="variant"
    :class="props.class"
    @checked-change="(next: CheckedState) => emit('update:modelValue', next)"
  >
    <CheckboxIndicator v-slot="{ state }">
      <MinusIcon v-if="state.indeterminate" data-slot="checkbox-icon" />
      <CheckIcon v-else data-slot="checkbox-icon" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import type { CheckedState } from "@ui-sdk/core/checkbox"
import { Checkbox as CheckboxRoot, CheckboxIndicator } from "@ui-sdk/vue/checkbox"
import { CheckIcon, MinusIcon } from "@lucide/vue"
import type { Size, ToneColor } from "../../core/types.js"

const props = withDefaults(
  defineProps<{
    modelValue?: CheckedState | undefined
    disabled?: boolean
    class?: HTMLAttributes["class"] | undefined
    size?: Size | undefined
    variant?: "surface" | "soft" | undefined
    color?: ToneColor | undefined
  }>(),
  {
    modelValue: undefined,
    disabled: false,
    class: undefined,
    size: "m",
    variant: "surface",
    color: undefined,
  },
)
const emit = defineEmits<{ "update:modelValue": [value: CheckedState] }>()
</script>

<style>
:where([data-slot="checkbox"]) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
  height: var(--space-md);
  width: var(--space-md);
  cursor: pointer;
}

:where([data-slot="checkbox"][data-size="s"]) {
  height: calc(var(--space-md) * 0.875);
  width: calc(var(--space-md) * 0.875);
}

:where([data-slot="checkbox"])::before {
  content: "";
  display: block;
  height: 100%;
  width: 100%;
  border-radius: var(--radius-min);
}

:where([data-slot="checkbox"][data-size="s"])::before {
  border-radius: var(--radius-min);
}

:where([data-slot="checkbox"]:focus-visible) {
  outline: none;
}

:where([data-slot="checkbox"]:focus-visible)::before {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="checkbox"][data-disabled]) {
  cursor: default;
}

:where([data-slot="checkbox-indicator"]) {
  position: absolute;
  top: 50%;
  left: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 9px;
  height: 9px;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

:where([data-slot="checkbox"][data-size="m"]) :where([data-slot="checkbox-indicator"]) {
  width: 10px;
  height: 10px;
}

:where([data-slot="checkbox-indicator"]) :where(svg) {
  inline-size: 100%;
  block-size: 100%;
  stroke-width: 2.5px;
}

:where([data-slot="checkbox"][data-variant="surface"][data-unchecked])::before {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

:where(
  [data-slot="checkbox"][data-variant="surface"]:is([data-checked], [data-indeterminate])
)::before {
  background-color: var(--tone);
}

:where([data-slot="checkbox"][data-variant="surface"]:is([data-checked], [data-indeterminate]))
  :where([data-slot="checkbox-indicator"]) {
  color: var(--tone-on-solid);
}

:where([data-slot="checkbox"][data-variant="surface"][data-disabled])::before {
  background-color: transparent;
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="checkbox"][data-variant="surface"][data-disabled])
  :where([data-slot="checkbox-indicator"]) {
  color: var(--fg-disabled);
}

:where([data-slot="checkbox"][data-variant="soft"])::before {
  background-color: var(--tone-subtle);
}

:where([data-slot="checkbox"][data-variant="soft"]:is([data-checked], [data-indeterminate]))
  :where([data-slot="checkbox-indicator"]) {
  color: var(--tone-text);
}

:where([data-slot="checkbox"][data-variant="soft"][data-disabled])::before {
  background-color: transparent;
}

:where([data-slot="checkbox"][data-variant="soft"][data-disabled])
  :where([data-slot="checkbox-indicator"]) {
  color: var(--fg-disabled);
}
</style>
