<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <TooltipTrigger
    v-bind="props.asChild ? forwardedProps : { ...forwardedProps, 'data-slot': 'tooltip-trigger' }"
  >
    <slot />
  </TooltipTrigger>
</template>

<script setup lang="ts">
import type { TooltipTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { TooltipTrigger, useForwardProps } from "reka-ui"

const props = defineProps<TooltipTriggerProps>()
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<TooltipTriggerProps>
</script>
