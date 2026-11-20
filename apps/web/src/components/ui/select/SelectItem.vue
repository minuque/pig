<template>
  <SelectItem data-slot="select-item" v-bind="forwarded" :class="props.class">
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

<style>
/* 选项：不留勾选图标的槽位，左右内边距对称；选中项用高亮底标出 */
:where([data-slot="select-item"]) {
  position: relative;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  block-size: var(--control-md);
  padding-inline: var(--space-sm);
  border-radius: var(--radius-control);
  outline: none;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  user-select: none;
  cursor: pointer;
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-item"]) {
  block-size: var(--space-lg);
  border-radius: calc(var(--radius-control) / 2);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="select-item"][data-disabled]) {
  color: var(--fg-disabled);
  cursor: default;
}

:where([data-slot="select-item"][data-state="checked"]:not([data-highlighted])) {
  background-color: var(--bg-selected);
  color: var(--fg);
}

/* solid 内容里悬停项取实心强调色 */
:where([data-slot="select-content"][data-variant="solid"])
  :where([data-slot="select-item"][data-highlighted]) {
  background-color: var(--tone);
  color: var(--fg-on-accent);
}

:where([data-slot="select-content"][data-variant="soft"])
  :where([data-slot="select-item"][data-highlighted]) {
  background-color: var(--bg-hover);
}
</style>
