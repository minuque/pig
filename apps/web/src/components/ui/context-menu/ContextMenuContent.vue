<template>
  <ContextMenuPortal>
    <ContextMenuContent
      data-slot="context-menu-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-popover text-ink z-(--z-drawer) max-h-(--reka-context-menu-content-available-height) min-w-(--size-menu) origin-(--reka-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-(--radius-lg) border border-hairline p-(--spacing-xxs) shadow-elevated translate-y-1 opacity-0 transition-[translate,opacity] duration-(--duration-fast) ease-(--ease-out) data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-soft_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
      :class="props.class"
    >
      <slot />
    </ContextMenuContent>
  </ContextMenuPortal>
</template>

<script setup lang="ts">
import type { ContextMenuContentEmits, ContextMenuContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ContextMenuContent, ContextMenuPortal, useForwardPropsEmits } from "reka-ui"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<ContextMenuContentProps & { class?: HTMLAttributes["class"] }>(),
  {
    class: undefined,
  },
)
const emits = defineEmits<ContextMenuContentEmits>()

const delegatedProps = reactiveOmit(props, "class")
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<ContextMenuContentProps>
</script>
