<template>
  <SelectContentPrimitive
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :side-offset="4"
    :collision-padding="10"
    v-bind="$attrs"
    class="reveal-menu"
    :class="props.class"
  >
    <slot />
  </SelectContentPrimitive>
</template>

<script setup lang="ts">
import type { ToneColor } from "../../core/types.js"
import type { HTMLAttributes } from "vue"
import { SelectContent as SelectContentPrimitive } from "@ui-sdk/vue/select"
import { useSelectSize } from "./select-context.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    variant?: "solid" | "soft"
    color?: ToneColor
  }>(),
  { class: undefined, variant: "soft" },
)
const size = useSelectSize()
</script>

<style>
:where([data-slot="select-content"]) {
  box-sizing: border-box;
  min-inline-size: var(--anchor-width);
  max-inline-size: var(--available-width);
  max-block-size: var(--available-height);
  margin: 0;
  padding: var(--space-2xs);
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 0;
  border-radius: var(--radius-card);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
  outline: none;
  transform-origin: var(--transform-origin);
}

:where([data-slot="select-content"]) > * + * {
  margin-block-start: var(--menu-item-gap);
}

:where([data-slot="select-content"][data-size="s"]) {
  padding: var(--space-2xs);
  border-radius: var(--radius-control);
}

:where([data-slot="select-content"]:has([data-slot="select-list"])) {
  display: flex;
  flex-direction: column;
  max-inline-size: min(22rem, var(--available-width));
  max-block-size: min(22rem, var(--available-height));
  padding: 0;
  overflow: hidden;
}

:where([data-slot="select-content"] > :is([data-slot="select-empty"], [data-slot="select-list"])) {
  margin-block-start: 0;
}
</style>
