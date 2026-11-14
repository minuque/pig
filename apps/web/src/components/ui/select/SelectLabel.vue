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

<style scoped>
/* 与选项同一组左右边距：选项不再留勾选图标的槽位 */
.rt-SelectLabel[data-slot="select-label"] {
  padding-inline: var(--space-sm);
}
</style>
