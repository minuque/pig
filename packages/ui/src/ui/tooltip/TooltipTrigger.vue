<template>
  <TooltipTriggerPrimitive v-bind="$attrs">
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <template v-else #default><slot /></template>
  </TooltipTriggerPrimitive>
</template>

<script setup lang="ts">
import { TooltipTrigger as TooltipTriggerPrimitive } from "@ui-sdk/vue/tooltip"
import { AsChildSlot } from "../primitive/index.js"

defineOptions({ inheritAttrs: false })

defineProps<{ asChild?: boolean }>()
</script>
