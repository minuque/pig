<template>
  <ContextMenuItem
    data-slot="context-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    class="relative flex min-h-8 cursor-pointer select-none items-center gap-(--spacing-xs) rounded-(--radius-sm) px-(--spacing-xs) py-(--spacing-xxs) text-body-sm outline-hidden transition-[background-color,color] duration-(--duration-fast) ease-(--ease-smooth) focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:cursor-default data-[disabled]:opacity-(--opacity-disabled) data-[inset]:pl-(--spacing-xxl) data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-canvas-soft data-[variant=destructive]:focus:text-destructive sm:min-h-7 sm:text-caption [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:opacity-80"
    :class="props.class"
  >
    <slot />
  </ContextMenuItem>
</template>

<script setup lang="ts">
import type { ContextMenuItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
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

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuItemProps>
</script>
