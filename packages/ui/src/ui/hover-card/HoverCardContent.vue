<template>
  <HoverCardContentPrimitive
    :data-size="size"
    :align="align"
    :side-offset="8"
    :collision-padding="10"
    v-bind="$attrs"
    class="reveal-menu"
    :class="props.class"
    :style="{ maxInlineSize: props.maxWidth }"
  >
    <slot />
  </HoverCardContentPrimitive>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { HoverCardContent as HoverCardContentPrimitive } from "@ui-sdk/vue/hover-card"
import type { Size } from "../../core/types.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    size?: Size
    align?: "start" | "center" | "end"
    maxWidth?: string
  }>(),
  { class: undefined, size: "m", align: "start", maxWidth: "480px" },
)
</script>

<style>
:where([data-slot="hover-card-content"]) {
  box-sizing: border-box;
  overflow: auto;
  max-block-size: var(--available-height);
  background-color: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
  color: var(--fg);
  transform-origin: var(--transform-origin);
}

:where([data-slot="hover-card-content"][data-size="s"]) {
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="hover-card-content"][data-size="m"]) {
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

:where([data-slot="hover-card-content"][data-size="l"]) {
  padding: var(--space-lg);
  border-radius: var(--radius-card);
}
</style>
