<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-surface text-ink z-(--z-drawer) max-h-(--reka-popover-content-available-height) origin-(--reka-popover-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-(--radius-lg) border border-hairline p-(--spacing-md) shadow-elevated translate-y-1 opacity-0 transition-[translate,opacity] duration-(--duration-fast) ease-(--ease-out) data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-soft_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="props.class"
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>

<script setup lang="ts">
import type { PopoverContentEmits, PopoverContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { PopoverContent, PopoverPortal, useForwardPropsEmits } from "reka-ui"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<PopoverContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    class: undefined,
    sideOffset: 4,
  },
)
const emits = defineEmits<PopoverContentEmits>()

const delegatedProps = reactiveOmit(props, "class")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<PopoverContentProps>
</script>
