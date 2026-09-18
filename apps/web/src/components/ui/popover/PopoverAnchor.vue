<template>
  <PopoverAnchor data-slot="popover-anchor" v-bind="forwardedProps">
    <slot />
  </PopoverAnchor>
</template>

<script setup lang="ts">
import type { PopoverAnchorProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { PopoverAnchor, useForwardProps } from "reka-ui"

const props = defineProps<PopoverAnchorProps>()
// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<PopoverAnchorProps>
</script>
