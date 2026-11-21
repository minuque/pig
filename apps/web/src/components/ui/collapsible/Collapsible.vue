<template>
  <!-- as-child 时不要把 data-slot 写在触发元素上：会覆盖子元素自己的标记 -->
  <CollapsibleRoot
    v-slot="slotProps"
    v-bind="props.asChild ? forwarded : { ...forwarded, 'data-slot': 'collapsible' }"
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
