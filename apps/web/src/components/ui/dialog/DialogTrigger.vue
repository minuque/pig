<template>
  <DialogTriggerPrimitive v-bind="$attrs">
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <template v-else #default><slot /></template>
  </DialogTriggerPrimitive>
</template>

<script setup lang="ts">
import { DialogTrigger as DialogTriggerPrimitive } from "@ui-sdk/vue/dialog"
import { AsChildSlot } from "@components/ui/primitive/index.js"

defineOptions({ inheritAttrs: false })

defineProps<{ asChild?: boolean }>()
</script>
