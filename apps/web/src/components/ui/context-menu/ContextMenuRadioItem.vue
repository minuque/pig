<template>
  <ContextMenuRadioItem
    data-slot="context-menu-radio-item"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    data-menu-item
    :class="props.class"
  >
    <slot />
  </ContextMenuRadioItem>
</template>

<script setup lang="ts">
import type { ContextMenuRadioItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuRadioItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<ContextMenuRadioItemProps & { class?: HTMLAttributes["class"]; color?: string }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuRadioItemProps>
</script>
