<template>
  <SelectItem data-slot="select-item" v-bind="forwarded" class="rt-SelectItem" :class="props.class">
    <SelectItemIndicator class="rt-SelectItemIndicator">
      <CheckIcon class="rt-SelectItemIndicatorIcon" />
    </SelectItemIndicator>

    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>

<script setup lang="ts">
import type { SelectItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectItem, SelectItemIndicator, SelectItemText, useForwardProps } from "reka-ui"
import { CheckIcon } from "@components/icons/index.js"

const props = withDefaults(defineProps<SelectItemProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectItemProps>
</script>
