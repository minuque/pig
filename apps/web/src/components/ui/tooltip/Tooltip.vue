<template>
  <TooltipRoot :delay="400" v-bind="$attrs">
    <slot />
  </TooltipRoot>
</template>

<script setup lang="ts">
import { Tooltip as TooltipRoot } from "@ui-sdk/vue/tooltip"

defineOptions({ inheritAttrs: false })
</script>
