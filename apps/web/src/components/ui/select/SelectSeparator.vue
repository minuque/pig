<template>
  <SelectSeparator data-slot="select-separator" v-bind="forwarded" :class="props.class" />
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

<style>
/* 分割线上下取弹窗内边距，左右与选项同宽 */
:where([data-slot="select-separator"]) {
  block-size: 1px;
  margin-block: var(--space-xs);
  margin-inline: var(--space-sm);
  background-color: var(--bg-emphasis);
}
</style>
