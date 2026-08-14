<script setup lang="ts">
import type { TooltipTriggerProps } from "reka-ui";
import type { ComputedRef } from "vue";
import { TooltipTrigger, useForwardProps } from "reka-ui";

const props = defineProps<TooltipTriggerProps>();

const forwarded = useForwardProps(props) as ComputedRef<TooltipTriggerProps>;
</script>

<template>
  <TooltipTrigger data-slot="tooltip-trigger" v-bind="forwarded">
    <slot />
  </TooltipTrigger>
</template>
