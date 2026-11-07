<template>
  <TooltipProvider v-bind="forwardedProps">
    <slot />
  </TooltipProvider>
</template>

<script setup lang="ts">
import type { TooltipProviderProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { TooltipProvider, useForwardProps } from "reka-ui"

// 只对键盘焦点弹提示：弹框打开时自动聚焦首个按钮，不该把它的提示带出来
const props = withDefaults(defineProps<TooltipProviderProps>(), {
  delayDuration: 400,
  ignoreNonKeyboardFocus: true,
})
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<TooltipProviderProps>
</script>
