<template>
  <DropdownMenuCheckboxItem
    data-slot="dropdown-menu-checkbox-item"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    data-menu-item
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" data-menu-shortcut>{{ shortcut }}</div>
  </DropdownMenuCheckboxItem>
</template>

<script setup lang="ts">
import type { DropdownMenuCheckboxItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuCheckboxItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DropdownMenuCheckboxItemProps & {
      class?: HTMLAttributes["class"]
      shortcut?: string
      color?: string
    }
  >(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "shortcut", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuCheckboxItemProps>
</script>
