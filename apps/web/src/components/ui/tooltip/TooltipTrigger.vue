<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="forwardedProps">
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
