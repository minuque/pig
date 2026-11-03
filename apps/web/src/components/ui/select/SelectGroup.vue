<template>
  <SelectGroup
    data-slot="select-group"
    v-bind="forwarded"
    class="rt-SelectGroup"
    :class="props.class"
  >
    <slot />
  </SelectGroup>
</template>

<script setup lang="ts">
import type { SelectGroupProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectGroup, useForwardProps } from "reka-ui"

const props = withDefaults(defineProps<SelectGroupProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectGroupProps>
</script>
