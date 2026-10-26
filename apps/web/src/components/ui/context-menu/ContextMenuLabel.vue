<template>
  <ContextMenuLabel
    data-slot="context-menu-label"
    v-bind="forwardedProps"
    class="rt-BaseMenuLabel rt-ContextMenuLabel"
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
  defineProps<ContextMenuLabelProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuLabelProps>
</script>
