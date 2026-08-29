<template>
  <ContextMenuLabel
    data-slot="context-menu-label"
    :data-inset="inset ? '' : undefined"
    v-bind="forwardedProps"
    class="px-(--spacing-xs) py-(--spacing-xxs) text-eyebrow font-medium text-muted-foreground data-[inset]:pl-(--spacing-xxl)"
    :class="props.class"
  >
    <slot />
  </ContextMenuLabel>
</template>

<script setup lang="ts">
import type { ContextMenuLabelProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuLabel, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<ContextMenuLabelProps & { class?: HTMLAttributes["class"]; inset?: boolean }>(),
  { class: undefined, inset: false },
)
const delegatedProps = reactiveOmit(props, "class", "inset")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuLabelProps>
</script>
