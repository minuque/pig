<template>
  <CollapsibleRoot
    v-slot="slotProps"
    :data-slot="props.asChild ? undefined : 'collapsible'"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </CollapsibleRoot>
</template>

<script setup lang="ts">
import type { CollapsibleRootEmits, CollapsibleRootProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { CollapsibleRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<CollapsibleRootProps>()
const emits = defineEmits<CollapsibleRootEmits>()
const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<CollapsibleRootProps>
</script>
