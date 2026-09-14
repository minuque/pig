<template>
  <ContextMenuRoot v-slot="slotProps" data-slot="context-menu" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </ContextMenuRoot>
</template>

<script setup lang="ts">
import type { ContextMenuRootEmits, ContextMenuRootProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { ContextMenuRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<ContextMenuRootProps>()

const emits = defineEmits<ContextMenuRootEmits>()

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<ContextMenuRootProps>
</script>
