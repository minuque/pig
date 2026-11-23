<template>
  <PopoverContentPrimitive
    :side-offset="8"
    :collision-padding="10"
    :data-size="size"
    v-bind="$attrs"
    class="reveal-menu"
    :class="props.class"
    :style="{ maxInlineSize: props.maxWidth }"
  >
    <slot />
  </PopoverContentPrimitive>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { PopoverContent as PopoverContentPrimitive } from "@ui-sdk/vue/popover"
import type { Size } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    size?: Size
    maxWidth?: string
  }>(),
  { class: undefined, size: "m", maxWidth: "480px" },
)
</script>

<style>
:where([data-slot="popover-content"]) {
  box-sizing: border-box;
  overflow: auto;
  min-inline-size: var(--anchor-width);
  max-block-size: var(--available-height);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
  outline: 0;
  transform-origin: var(--transform-origin);
}

:where([data-slot="popover-content"][data-size="s"]) {
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="popover-content"][data-size="m"]) {
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

:where([data-slot="popover-content"][data-size="l"]) {
  padding: var(--space-lg);
  border-radius: var(--radius-dialog);
}
</style>
