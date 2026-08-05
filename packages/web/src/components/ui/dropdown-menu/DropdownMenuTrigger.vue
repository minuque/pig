<script setup lang="ts">
import type { DropdownMenuTriggerProps } from "reka-ui";
import type { ComputedRef } from "vue";
import { DropdownMenuTrigger, useForwardProps } from "reka-ui";

const props = defineProps<DropdownMenuTriggerProps>();

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(props) as ComputedRef<DropdownMenuTriggerProps>;
</script>

<template>
  <DropdownMenuTrigger data-slot="dropdown-menu-trigger" v-bind="forwardedProps">
    <slot />
  </DropdownMenuTrigger>
</template>
