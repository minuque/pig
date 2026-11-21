<template>
  <DropdownMenuRadioItem
    data-slot="dropdown-menu-radio-item"
    v-bind="forwardedProps"
    :data-tone="props.color"
    data-menu-item
    :class="props.class"
  >
    <slot />
  </DropdownMenuRadioItem>
</template>

<script setup lang="ts">
import type { ToneColor } from "@/types/ui-type.js"
import type { DropdownMenuRadioItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuRadioItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DropdownMenuRadioItemProps & { class?: HTMLAttributes["class"]; color?: ToneColor }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuRadioItemProps>
</script>
