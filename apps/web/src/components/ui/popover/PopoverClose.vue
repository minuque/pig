<template>
  <PopoverClosePrimitive v-bind="$attrs">
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <template v-else #default><slot /></template>
  </PopoverClosePrimitive>
</template>

<script setup lang="ts">
import { PopoverClose as PopoverClosePrimitive } from "@ui-sdk/vue/popover"
import { AsChildSlot } from "@components/ui/primitive/index.js"

defineOptions({ inheritAttrs: false })

defineProps<{ asChild?: boolean }>()
</script>
