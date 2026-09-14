<template>
  <PopoverTrigger data-slot="popover-trigger" v-bind="forwardedProps">
    <slot />
  </PopoverTrigger>
</template>

<script setup lang="ts">
import type { PopoverTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { PopoverTrigger, useForwardProps } from "reka-ui"

const props = defineProps<PopoverTriggerProps>()

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<PopoverTriggerProps>
</script>
