<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <DialogTrigger
    v-bind="props.asChild ? forwardedProps : { ...forwardedProps, 'data-slot': 'dialog-trigger' }"
  >
    <slot />
  </DialogTrigger>
</template>

<script setup lang="ts">
import type { DialogTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { DialogTrigger, useForwardProps } from "reka-ui"

const props = defineProps<DialogTriggerProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<DialogTriggerProps>
</script>
