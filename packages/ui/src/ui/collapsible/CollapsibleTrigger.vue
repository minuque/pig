<template>
  <CollapsibleTrigger>
    <template v-if="asChild" #render="{ props: partProps }">
      <AsChildSlot :part-props="partProps"><slot /></AsChildSlot>
    </template>

    <slot />
  </CollapsibleTrigger>
</template>

<script setup lang="ts">
import { CollapsibleTrigger } from "@ui-sdk/vue/collapsible"
import { AsChildSlot } from "../primitive/index.js"

withDefaults(defineProps<{ asChild?: boolean }>(), { asChild: false })
</script>
