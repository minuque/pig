<template>
  <DropdownMenuSub v-bind="forwardedProps">
    <slot />
  </DropdownMenuSub>
</template>

<script setup lang="ts">
import type { DropdownMenuSubProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { DropdownMenuSub, useForwardProps } from "reka-ui"

const props = defineProps<DropdownMenuSubProps>()
const forwardedProps = useForwardProps(props) as ComputedRef<DropdownMenuSubProps>
</script>
