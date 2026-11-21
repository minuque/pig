<template>
  <PopoverPortal>
    <PopoverContentPrimitive
      data-slot="popover-content"
      :side-offset="8"
      :collision-padding="10"
      :data-size="size"
      v-bind="{ ...$attrs, ...forwarded }"
      class="reveal-menu"
      :class="props.class"
      :style="{ maxInlineSize: props.maxWidth }"
    >
      <slot />
    </PopoverContentPrimitive>
  </PopoverPortal>
</template>

<script setup lang="ts">
import type { PopoverContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { PopoverContent as PopoverContentPrimitive, PopoverPortal, useForwardProps } from "reka-ui"
import type { Size } from "@/types/ui-type.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PopoverContentProps & {
      class?: HTMLAttributes["class"]
      size?: Size
      maxWidth?: string
    }
  >(),
  { class: undefined, size: "m", maxWidth: "480px" },
)
const delegatedProps = reactiveOmit(props, "class", "size", "maxWidth")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<PopoverContentProps>
</script>

<style>
:where([data-slot="popover-content"]) {
  box-sizing: border-box;
  position: relative;
  z-index: var(--z-popover);
  overflow: auto;
  min-inline-size: var(--reka-popover-trigger-width);
  border: var(--border-width) solid var(--float-border);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  outline: 0;
  transform-origin: var(--reka-popover-content-transform-origin);
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
