<template>
  <CollapsibleTrigger
    v-bind="props.asChild ? forwarded : { ...forwarded, 'data-slot': 'collapsible-trigger' }"
  >
    <slot />
  </CollapsibleTrigger>
</template>

<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { CollapsibleTrigger, useForwardProps } from "reka-ui"

const props = defineProps<CollapsibleTriggerProps>()
const forwarded = useForwardProps(props) as ComputedRef<CollapsibleTriggerProps>
</script>
