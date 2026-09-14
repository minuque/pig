<template>
  <PopoverRoot v-slot="slotProps" data-slot="popover" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </PopoverRoot>
</template>

<script setup lang="ts">
import type { PopoverRootEmits, PopoverRootProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { PopoverRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<PopoverRootProps>()

const emits = defineEmits<PopoverRootEmits>()

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<PopoverRootProps>
</script>
