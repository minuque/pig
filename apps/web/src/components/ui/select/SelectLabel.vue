<template>
  <SelectLabel data-slot="select-label" v-bind="forwarded" :class="props.class">
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

<style>
/* 与选项同一组左右边距：选项不再留勾选图标的槽位 */
:where([data-slot="select-label"]) {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  block-size: var(--control-md);
  padding-inline: var(--space-sm);
  color: var(--gray-a10);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  user-select: none;
  cursor: default;
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-label"]) {
  block-size: var(--space-lg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}
</style>
