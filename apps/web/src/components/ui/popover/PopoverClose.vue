<template>
  <PopoverClose data-slot="popover-close" v-bind="forwardedProps">
    <slot />
  </PopoverClose>
</template>

<script setup lang="ts">
import type { PopoverCloseProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { PopoverClose, useForwardProps } from "reka-ui"

const props = defineProps<PopoverCloseProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<PopoverCloseProps>
</script>
