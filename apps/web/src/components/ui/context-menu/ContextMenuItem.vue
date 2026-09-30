<template>
  <ContextMenuItem
    data-slot="context-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    :class="[menuItemClass, props.class]"
  >
    <slot />
  </ContextMenuItem>
</template>

<script setup lang="ts">
import type { ContextMenuItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { menuItemClass } from "@components/ui/menu-item.js"
import { ContextMenuItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    ContextMenuItemProps & {
      class?: HTMLAttributes["class"]
      inset?: boolean
      variant?: "default" | "destructive"
    }
  >(),
  {
    class: undefined,
    variant: "default",
  },
)
const delegatedProps = reactiveOmit(props, "inset", "variant", "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuItemProps>
</script>
