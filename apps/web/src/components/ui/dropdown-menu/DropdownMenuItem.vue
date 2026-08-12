<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    :class="
      cn(
        'relative flex cursor-default select-none items-center gap-(--spacing-xs) rounded-(--radius-sm) px-(--spacing-xs) py-(--spacing-xxs) text-caption outline-hidden transition-[background-color,color,transform] duration-(--duration-fast) ease-(--ease-smooth) focus:bg-accent focus:text-accent-foreground active:scale-[0.98] data-[disabled]:pointer-events-none data-[disabled]:opacity-(--opacity-disabled) data-[inset]:pl-(--spacing-xxl) data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-canvas-soft data-[variant=destructive]:focus:text-destructive',
        props.class,
      )
    "
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import type { DropdownMenuItemProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DropdownMenuItem, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils.js";

const props = withDefaults(
  defineProps<
    DropdownMenuItemProps & {
      class?: HTMLAttributes["class"];
      inset?: boolean;
      variant?: "default" | "destructive";
    }
  >(),
  {
    class: undefined,
    variant: "default",
  },
);

const delegatedProps = reactiveOmit(props, "inset", "variant", "class");

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuItemProps>;
</script>
