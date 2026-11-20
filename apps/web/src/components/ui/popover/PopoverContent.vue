<template>
  <PopoverPortal>
    <PopoverContentPrimitive
      data-slot="popover-content"
      :side-offset="8"
      :collision-padding="10"
      :data-size="size"
      v-bind="{ ...$attrs, ...forwarded }"
      class="reveal-menu"
      :class="props.class"
      :style="{ maxInlineSize: props.maxWidth }"
    >
      <slot />
    </PopoverContentPrimitive>
  </PopoverPortal>
</template>

<script setup lang="ts">
import type { PopoverContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { PopoverContent as PopoverContentPrimitive, PopoverPortal, useForwardProps } from "reka-ui"
import type { Size } from "@components/ui/size.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    PopoverContentProps & {
      class?: HTMLAttributes["class"]
      /** 内边距与圆角档：s、m、l */
      size?: Size
      /** 面板最大宽度，默认沿用 rt 的 480px */
      maxWidth?: string
    }
  >(),
  { class: undefined, size: "m", maxWidth: "480px" },
)
const delegatedProps = reactiveOmit(props, "class", "size", "maxWidth")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<PopoverContentProps>
</script>

<style>
/* 浮卡：实色底 + 1px 环 + 精致阴影，宽度跟随触发器但不小于它 */
:where([data-slot="popover-content"]) {
  box-sizing: border-box;
  position: relative;
  overflow: auto;
  min-inline-size: var(--reka-popover-trigger-width);
  background-color: var(--bg-raised);
  box-shadow:
    0 0 0 var(--border-width) var(--border),
    var(--menu-shadow);
  outline: 0;
  transform-origin: var(--reka-popover-content-transform-origin);
}

:where([data-slot="popover-content"][data-size="s"]) {
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="popover-content"][data-size="m"]) {
  padding: var(--space-md);
  border-radius: var(--radius-card);
}

:where([data-slot="popover-content"][data-size="l"]) {
  padding: var(--space-lg);
  border-radius: var(--radius-dialog);
}
</style>
