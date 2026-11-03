<template>
  <RadioGroupItem
    data-slot="radio-cards-item"
    v-bind="forwarded"
    class="rt-reset rt-BaseCard rt-RadioCardsItem"
    :class="props.class"
  >
    <slot />
  </RadioGroupItem>
</template>

<script setup lang="ts">
import type { RadioGroupItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { RadioGroupItem, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<RadioGroupItemProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<RadioGroupItemProps>
</script>
