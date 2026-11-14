<template>
  <SelectItem data-slot="select-item" v-bind="forwarded" class="rt-SelectItem" :class="props.class">
    <SelectItemText><slot /></SelectItemText>
  </SelectItem>
</template>

<script setup lang="ts">
import type { SelectItemProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { SelectItem, SelectItemText, useForwardProps } from "reka-ui"

const props = withDefaults(defineProps<SelectItemProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardProps(delegatedProps) as ComputedRef<SelectItemProps>
</script>

<style scoped>
/* 选中项用高亮底标出，不留勾选图标的槽位，左右内边距对称 */
.rt-SelectItem[data-slot="select-item"] {
  padding-inline: var(--space-sm);
}

.rt-SelectItem[data-state="checked"]:not([data-highlighted]) {
  background: var(--btn-selected);
  color: var(--contrast-foreground);
}
</style>
