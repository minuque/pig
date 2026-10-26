<template>
  <DropdownMenuGroup v-bind="forwardedProps" class="rt-BaseMenuGroup rt-DropdownMenuGroup">
    <slot />
  </DropdownMenuGroup>
</template>

<script setup lang="ts">
import type { DropdownMenuGroupProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { DropdownMenuGroup, useForwardProps } from "reka-ui"

const props = defineProps<DropdownMenuGroupProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<DropdownMenuGroupProps>
</script>
