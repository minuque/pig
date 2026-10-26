<template>
  <DropdownMenuRadioGroup
    v-bind="forwardedProps"
    class="rt-BaseMenuRadioGroup rt-DropdownMenuRadioGroup"
    :class="props.class"
  >
    <slot />
  </DropdownMenuRadioGroup>
</template>

<script setup lang="ts">
import type { DropdownMenuRadioGroupProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuRadioGroup, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DropdownMenuRadioGroupProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuRadioGroupProps>
</script>
