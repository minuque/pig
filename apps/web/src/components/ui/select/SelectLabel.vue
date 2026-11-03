<template>
  <SelectLabel
    data-slot="select-label"
    v-bind="forwarded"
    class="rt-SelectLabel"
    :class="props.class"
  >
    <slot />
  </SelectLabel>
</template>

<script setup lang="ts">
import type { SelectLabelProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectLabel, useForwardProps } from "reka-ui"

const props = withDefaults(defineProps<SelectLabelProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectLabelProps>
</script>
