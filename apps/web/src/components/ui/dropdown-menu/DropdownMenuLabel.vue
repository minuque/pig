<template>
  <DropdownMenuLabel
    data-slot="dropdown-menu-label"
    v-bind="forwardedProps"
    class="rt-BaseMenuLabel rt-DropdownMenuLabel"
    :class="props.class"
  >
    <slot />
  </DropdownMenuLabel>
</template>

<script setup lang="ts">
import type { DropdownMenuLabelProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuLabel, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DropdownMenuLabelProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuLabelProps>
</script>
