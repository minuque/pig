<template>
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
// 外部：reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，须 cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<DropdownMenuTriggerProps>
const { forwardRef, currentElement } = useForwardExpose()
const anchor = usePopperAnchor()

// 外部：reka 在 onMounted 里替换 triggerElement 属性，不触发响应式，须自己维护 ref
watchPostEffect(() => {
  if (anchor) anchor.value = currentElement.value
})
</script>
