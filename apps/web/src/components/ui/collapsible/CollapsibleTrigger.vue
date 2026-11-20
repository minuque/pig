<template>
  <CollapsibleTrigger
    :data-slot="props.asChild ? undefined : 'collapsible-trigger'"
    v-bind="forwarded"
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
