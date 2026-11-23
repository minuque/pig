<template>
  <PopoverTriggerPrimitive v-bind="$attrs">
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <template v-else #default><slot /></template>
  </PopoverTriggerPrimitive>
</template>

<script setup lang="ts">
import { PopoverTrigger as PopoverTriggerPrimitive } from "@ui-sdk/vue/popover"
import { AsChildSlot } from "@components/ui/primitive/index.js"

defineOptions({ inheritAttrs: false })

defineProps<{ asChild?: boolean }>()
</script>
