<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    :class="[menuItemClass, props.class]"
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import type { DropdownMenuItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { menuItemClass } from "@components/ui/menu-item.js"
import { DropdownMenuItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DropdownMenuItemProps & {
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
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuItemProps>
</script>
