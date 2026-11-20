<template>
  <DropdownMenuSubTrigger
    data-slot="dropdown-menu-sub-trigger"
    v-bind="forwardedProps"
    :data-accent-color="props.color"
    data-menu-item
    data-menu-sub-trigger
    :class="props.class"
  >
    <slot />

    <div data-menu-shortcut>
      <ChevronRightIcon data-menu-sub-trigger-icon />
    </div>
  </DropdownMenuSubTrigger>
</template>

<script setup lang="ts">
import type { DropdownMenuSubTriggerProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuSubTrigger, useForwardProps } from "reka-ui"
import { ChevronRightIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<DropdownMenuSubTriggerProps & { class?: HTMLAttributes["class"]; color?: string }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class", "color")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuSubTriggerProps>
</script>
