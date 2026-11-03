<template>
  <ContextMenuItem
    data-slot="context-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant === 'destructive' ? undefined : variant"
    v-bind="forwardedProps"
    :data-accent-color="variant === 'destructive' ? 'red' : props.color"
    class="rt-BaseMenuItem rt-ContextMenuItem"
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" class="rt-BaseMenuShortcut rt-ContextMenuShortcut">{{ shortcut }}</div>
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
      /** 右对齐的快捷键提示，rt 在 Item 上提供同名属性 */
      shortcut?: string
      /** accent 色，Item 的文字色跟随它 */
      color?: string
    }
  >(),
  {
    class: undefined,
    variant: "default",
  },
)
const delegatedProps = reactiveOmit(props, "inset", "variant", "shortcut", "color", "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<ContextMenuItemProps>
</script>
