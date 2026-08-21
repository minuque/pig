<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from "reka-ui";
import type { ComputedRef } from "vue";
import { TooltipProvider, TooltipRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<TooltipRootProps>();
const emits = defineEmits<TooltipRootEmits>();

const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<TooltipRootProps>;
</script>

<template>
  <TooltipProvider>
    <TooltipRoot v-slot="slotProps" data-slot="tooltip" v-bind="forwarded">
      <slot v-bind="slotProps" />
    </TooltipRoot>
  </TooltipProvider>
</template>
