<template>
  <ContextMenuRadioGroup
    v-bind="forwardedProps"
    class="rt-BaseMenuRadioGroup rt-ContextMenuRadioGroup"
    :class="props.class"
  >
    <slot />
  </ContextMenuRadioGroup>
</template>

<script setup lang="ts">
import type { ContextMenuRadioGroupProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuRadioGroup, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<ContextMenuRadioGroupProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuRadioGroupProps>
</script>
