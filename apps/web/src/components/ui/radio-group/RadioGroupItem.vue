<template>
  <!-- 有内容时按 rt 的结构渲染成 label：按钮空着，文字进内层 span -->
  <label
    v-if="$slots.default"
    data-slot="radio-group-item-label"
    :data-size="group.size"
    :class="props.class"
  >
    <RadioGroupItem
      data-slot="radio-group-item"
      v-bind="forwardedProps"
      :data-accent-color="group.color"
      :data-size="group.size"
      :data-variant="group.variant"
      :data-high-contrast="group.highContrast || undefined"
    />

    <span data-slot="radio-group-item-inner"><slot /></span>
  </label>

  <RadioGroupItem
    v-else
    data-slot="radio-group-item"
    v-bind="forwardedProps"
    :data-accent-color="group.color"
    :data-size="group.size"
    :data-variant="group.variant"
    :data-high-contrast="group.highContrast || undefined"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed, inject } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupItem, useForwardProps } from "reka-ui"
import { RADIO_GROUP_KEY } from "./type.js"

const props = withDefaults(
  defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<RadioGroupItemProps>
const group = inject(
  RADIO_GROUP_KEY,
  computed(
    () =>
      ({
        size: "m",
        variant: "surface",
        color: undefined,
        highContrast: false,
      }) as const,
  ),
)
</script>

<style>
:where([data-slot="radio-group-item-label"]) {
  display: flex;
  gap: 0.5em;
  width: fit-content;
  align-items: center;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="radio-group-item-label"][data-size="s"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="radio-group-item-label"][data-size="l"]) {
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="radio-group-item-inner"]) {
  min-width: 0;
}

:where([data-slot="radio-group-item"]) {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  appearance: none;
  inline-size: var(--space-md);
  block-size: var(--space-md);
  padding: 0;
  border-radius: 100%;
  background: transparent;
  cursor: pointer;
}

:where([data-slot="radio-group-item"][data-size="s"]) {
  inline-size: calc(var(--space-md) * 0.875);
  block-size: calc(var(--space-md) * 0.875);
}

:where([data-slot="radio-group-item"][data-size="l"]) {
  inline-size: calc(var(--space-md) * 1.25);
  block-size: calc(var(--space-md) * 1.25);
}

:where([data-slot="radio-group-item"])::before,
:where([data-slot="radio-group-item"])::after {
  content: "";
  position: absolute;
  inline-size: 100%;
  block-size: 100%;
  border-radius: 100%;
}

:where([data-slot="radio-group-item"])::after {
  transform: scale(0.4);
  pointer-events: none;
}

:where([data-slot="radio-group-item"]:not([data-state="checked"]))::after {
  content: none;
}

:where([data-slot="radio-group-item"]:focus-visible)::before {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-slot="radio-group-item"][data-disabled]) {
  cursor: default;
}

:where([data-slot="radio-group-item"][data-variant="surface"]:not([data-state="checked"]))::before {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a7);
}

:where([data-slot="radio-group-item"][data-variant="surface"][data-state="checked"])::before {
  background-color: var(--accent-indicator);
}

:where([data-slot="radio-group-item"][data-variant="surface"])::after {
  background-color: var(--accent-contrast);
}

:where(
  [data-slot="radio-group-item"][data-variant="surface"][data-state="checked"][data-high-contrast]
)::before {
  background-color: var(--accent-12);
}

:where([data-slot="radio-group-item"][data-variant="surface"][data-high-contrast])::after {
  background-color: var(--accent-1);
}

:where([data-slot="radio-group-item"][data-variant="surface"][data-disabled])::before {
  background-color: var(--gray-a3);
  box-shadow: inset 0 0 0 var(--border-width) var(--gray-a6);
}

:where([data-slot="radio-group-item"][data-variant="surface"][data-disabled])::after {
  background-color: var(--gray-a8);
}

:where([data-slot="radio-group-item"][data-variant="classic"]:not([data-state="checked"]))::before {
  background-color: var(--bg-raised);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--gray-7),
    0 1px 2px var(--black-a1);
}

:where([data-slot="radio-group-item"][data-variant="classic"][data-state="checked"])::before {
  background-color: var(--accent-indicator);
  background-image: linear-gradient(to bottom, var(--white-a3), transparent, var(--black-a3));
  box-shadow:
    inset 0 0.5px 0.5px var(--white-a4),
    inset 0 -0.5px 0.5px var(--black-a4);
}

:where([data-slot="radio-group-item"][data-variant="classic"])::after {
  background-color: var(--accent-contrast);
}

:where(
  [data-slot="radio-group-item"][data-variant="classic"][data-state="checked"][data-high-contrast]
)::before {
  background-color: var(--accent-12);
}

:where([data-slot="radio-group-item"][data-variant="classic"][data-high-contrast])::after {
  background-color: var(--accent-1);
}

:where([data-slot="radio-group-item"][data-variant="classic"][data-disabled])::before {
  background-color: var(--gray-a3);
  background-image: none;
}

:where([data-slot="radio-group-item"][data-variant="classic"][data-disabled])::after {
  background-color: var(--gray-a8);
}

:where([data-slot="radio-group-item"][data-variant="soft"])::before {
  background-color: var(--accent-a4);
}

:where([data-slot="radio-group-item"][data-variant="soft"])::after {
  background-color: var(--accent-a11);
}

:where([data-slot="radio-group-item"][data-variant="soft"][data-high-contrast])::after {
  background-color: var(--accent-12);
}

:where([data-slot="radio-group-item"][data-variant="soft"]:focus-visible)::before {
  outline-color: var(--accent-8);
}

:where([data-slot="radio-group-item"][data-variant="soft"][data-disabled])::before {
  background-color: var(--gray-a3);
}

:where([data-slot="radio-group-item"][data-variant="soft"][data-disabled])::after {
  background-color: var(--gray-a8);
}
</style>
