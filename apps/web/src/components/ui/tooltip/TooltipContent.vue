<template>
  <TooltipPortal>
    <TooltipContent
      data-slot="tooltip-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="ring-1 ring-tooltip-ring bg-tooltip text-tooltip-fg text-eyebrow z-50 max-w-(--reka-tooltip-content-available-width) origin-(--reka-tooltip-content-transform-origin) rounded-(--radius-md) px-(--spacing-xs) py-(--spacing-xxs) shadow-elevated translate-y-1 opacity-0 transition-[translate,opacity] duration-(--duration-fast) ease-(--ease-out) data-[state=delayed-open]:translate-y-0 data-[state=delayed-open]:opacity-100 data-[state=instant-open]:translate-y-0 data-[state=instant-open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="props.class"
    >
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>

<script setup lang="ts">
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    class: undefined,
    sideOffset: 6,
  },
)
const emits = defineEmits<TooltipContentEmits>()
const delegatedProps = reactiveOmit(props, "class")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<TooltipContentProps>
</script>
