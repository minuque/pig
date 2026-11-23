<template>
  <HoverCardTriggerPrimitive v-bind="$attrs">
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <template v-else #default><slot /></template>
  </HoverCardTriggerPrimitive>
</template>

<script setup lang="ts">
import { HoverCardTrigger as HoverCardTriggerPrimitive } from "@ui-sdk/vue/hover-card"
import { AsChildSlot } from "../primitive/index.js"

defineOptions({ inheritAttrs: false })

defineProps<{ asChild?: boolean }>()
</script>
