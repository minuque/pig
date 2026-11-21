<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <DropdownMenuTrigger
    :ref="forwardRef"
    v-bind="
      props.asChild ? forwardedProps : { ...forwardedProps, 'data-slot': 'dropdown-menu-trigger' }
    "
  >
    <slot />
  </DropdownMenuTrigger>
</template>

<script setup lang="ts">
import type { DropdownMenuTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { DropdownMenuTrigger, useForwardExpose, useForwardProps } from "reka-ui"
import { watchPostEffect } from "vue"
import { usePopperAnchor } from "./popper-anchor.js"

const props = defineProps<DropdownMenuTriggerProps>()
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<DropdownMenuTriggerProps>
const { forwardRef, currentElement } = useForwardExpose()
const anchor = usePopperAnchor()

// reka 在 onMounted 里替换 triggerElement 属性，不触发响应式，这里改成我们自己写的 ref
watchPostEffect(() => {
  if (anchor) anchor.value = currentElement.value
})
</script>
