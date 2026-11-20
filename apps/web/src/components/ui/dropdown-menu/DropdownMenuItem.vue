<template>
  <DropdownMenuItem
    data-slot="dropdown-menu-item"
    :data-inset="inset ? '' : undefined"
    :data-variant="variant"
    v-bind="forwardedProps"
    :data-tone="variant === 'destructive' ? 'danger' : props.color"
    data-menu-item
    :class="props.class"
  >
    <slot />
    <div v-if="shortcut" data-menu-shortcut>{{ shortcut }}</div>
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import type { ToneColor } from "@/types/ui-type.js"
import type { DropdownMenuItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DropdownMenuItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DropdownMenuItemProps & {
      class?: HTMLAttributes["class"]
      inset?: boolean
      variant?: "default" | "destructive"
      /** 右对齐的快捷键提示，rt 在 Item 上提供同名属性 */
      shortcut?: string
      /** accent 色，Item 的文字色跟随它 */
      color?: ToneColor
    }
  >(),
  {
    class: undefined,
    variant: "default",
  },
)
const delegatedProps = reactiveOmit(props, "inset", "variant", "shortcut", "color", "class")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DropdownMenuItemProps>
</script>
