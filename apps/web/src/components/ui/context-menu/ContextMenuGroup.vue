<template>
  <ContextMenuGroup v-bind="forwardedProps" class="rt-BaseMenuGroup rt-ContextMenuGroup">
    <slot />
  </ContextMenuGroup>
</template>

<script setup lang="ts">
import type { ContextMenuGroupProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { ContextMenuGroup, useForwardProps } from "reka-ui"

const props = defineProps<ContextMenuGroupProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<ContextMenuGroupProps>
</script>
