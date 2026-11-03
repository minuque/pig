<template>
  <SelectSeparator
    data-slot="select-separator"
    v-bind="forwarded"
    class="rt-SelectSeparator"
    :class="props.class"
  />
</template>

<script setup lang="ts">
import type { SelectSeparatorProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectSeparator, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<SelectSeparatorProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectSeparatorProps>
</script>
