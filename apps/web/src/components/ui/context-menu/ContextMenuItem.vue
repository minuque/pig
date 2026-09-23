<template>
  <ContextMenuItem
    data-slot="context-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    class="relative flex min-h-7 cursor-default select-none items-center gap-(--spacing-xs) rounded-(--radius-md) px-(--spacing-xs) py-(--spacing-xxs) text-caption font-normal text-ink outline-hidden transition-[background-color,color] duration-(--duration-fast) ease-(--ease-smooth) data-[disabled]:pointer-events-none data-[disabled]:opacity-(--opacity-disabled) data-[highlighted]:bg-(--hover-quiet) data-[highlighted]:text-ink data-[inset]:ps-(--spacing-xxl) data-[variant=destructive]:text-destructive data-[variant=destructive]:data-[highlighted]:text-destructive [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-ink-muted [&_svg]:opacity-80 data-[variant=destructive]:[&_svg]:text-current data-[variant=destructive]:[&_svg]:opacity-100"
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
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuItemProps>
</script>
