<template>
  <label
    v-if="$slots.default"
    data-slot="radio-group-item-label"
    :data-size="group.size"
    :class="props.class"
  >
    <Radio
      data-radio-group-item
      :value="value"
      :disabled="disabled"
      :data-tone="group.color"
      :data-size="group.size"
      :data-variant="group.variant"
    />

    <span data-slot="radio-group-item-inner"><slot /></span>
  </label>

  <Radio
    v-else
    data-radio-group-item
    :value="value"
    :disabled="disabled"
    :data-tone="group.color"
    :data-size="group.size"
    :data-variant="group.variant"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, inject } from "vue"
import { Radio } from "@ui-sdk/vue/radio"
import { RADIO_GROUP_KEY } from "./type.js"

const props = withDefaults(
  defineProps<{
    value: string
    disabled?: boolean
    class?: HTMLAttributes["class"]
  }>(),
  { disabled: false, class: undefined },
)
const group = inject(
  RADIO_GROUP_KEY,
  computed(
    () =>
      ({
        size: "m",
        variant: "surface",
        color: undefined,
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

:where([data-radio-group-item]) {
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

:where([data-radio-group-item][data-size="s"]) {
  inline-size: calc(var(--space-md) * 0.875);
  block-size: calc(var(--space-md) * 0.875);
}

:where([data-radio-group-item][data-size="l"]) {
  inline-size: calc(var(--space-md) * 1.25);
  block-size: calc(var(--space-md) * 1.25);
}

:where([data-radio-group-item])::before,
:where([data-radio-group-item])::after {
  content: "";
  position: absolute;
  inline-size: 100%;
  block-size: 100%;
  border-radius: 100%;
}

:where([data-radio-group-item])::after {
  transform: scale(0.4);
  pointer-events: none;
}

:where([data-radio-group-item][data-unchecked])::after {
  content: none;
}

:where([data-radio-group-item]:focus-visible) {
  outline: none;
}

:where([data-radio-group-item]:focus-visible)::before {
  outline: 2px solid var(--focus-color);
  outline-offset: 2px;
}

:where([data-radio-group-item][data-disabled]) {
  cursor: default;
}

:where([data-radio-group-item][data-variant="surface"][data-unchecked])::before {
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
}

:where([data-radio-group-item][data-variant="surface"][data-checked])::before {
  background-color: var(--tone);
}

:where([data-radio-group-item][data-variant="surface"])::after {
  background-color: var(--fg-on-accent);
}

:where([data-radio-group-item][data-variant="surface"][data-disabled])::before {
  background-color: var(--bg-muted);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-radio-group-item][data-variant="surface"][data-disabled])::after {
  background-color: var(--fg-disabled);
}

:where([data-radio-group-item][data-variant="soft"])::before {
  background-color: var(--tone-subtle);
}

:where([data-radio-group-item][data-variant="soft"])::after {
  background-color: var(--tone-text);
}

:where([data-radio-group-item][data-variant="soft"][data-disabled])::before {
  background-color: var(--bg-muted);
}

:where([data-radio-group-item][data-variant="soft"][data-disabled])::after {
  background-color: var(--fg-disabled);
}
</style>
