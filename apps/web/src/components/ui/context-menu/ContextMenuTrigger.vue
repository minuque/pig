<template>
  <ContextMenuTrigger
    v-bind="
      props.asChild ? forwardedProps : { ...forwardedProps, 'data-slot': 'context-menu-trigger' }
    "
  >
    <slot />
  </ContextMenuTrigger>
</template>

<script setup lang="ts">
import type { ContextMenuTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { ContextMenuTrigger, useForwardProps } from "reka-ui"

const props = defineProps<ContextMenuTriggerProps>()
// 外部：reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，须 cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<ContextMenuTriggerProps>
</script>
