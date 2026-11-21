<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
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
