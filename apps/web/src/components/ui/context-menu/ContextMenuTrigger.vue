<template>
  <ContextMenuTrigger data-slot="context-menu-trigger" v-bind="forwardedProps">
    <slot />
  </ContextMenuTrigger>
</template>

<script setup lang="ts">
import type { ContextMenuTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { ContextMenuTrigger, useForwardProps } from "reka-ui"

const props = defineProps<ContextMenuTriggerProps>()

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<ContextMenuTriggerProps>
</script>
