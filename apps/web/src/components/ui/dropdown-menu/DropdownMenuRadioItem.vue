<template>
  <DropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    v-bind="forwardedProps"
    class="rt-BaseMenuItem rt-BaseMenuRadioItem rt-DropdownMenuItem rt-DropdownMenuRadioItem"
    :class="props.class"
  >
    <slot />

    <DropdownMenuItemIndicator class="rt-BaseMenuItemIndicator rt-DropdownMenuItemIndicator">
      <CheckIcon class="rt-BaseMenuItemIndicatorIcon rt-DropdownMenuItemIndicatorIcon" />
    </DropdownMenuItemIndicator>
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
import type { DropdownMenuRadioItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuItemIndicator, DropdownMenuRadioItem, useForwardProps } from "reka-ui"
import { CheckIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<DropdownMenuRadioItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuRadioItemProps>
</script>
