<template>
  <ContextMenuSub v-bind="forwardedProps">
    <slot />
  </ContextMenuSub>
</template>

<script setup lang="ts">
import type { ContextMenuSubProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { ContextMenuSub, useForwardProps } from "reka-ui"

const props = defineProps<ContextMenuSubProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<ContextMenuSubProps>
</script>
