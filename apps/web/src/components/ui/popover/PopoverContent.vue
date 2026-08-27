<template>
  <PopoverPortal>
    <PopoverContent
      data-slot="popover-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-surface text-ink z-(--z-drawer) origin-(--reka-popover-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-(--radius-md) border border-hairline p-(--spacing-xxs) shadow-elevated data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]"
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
