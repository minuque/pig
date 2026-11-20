<template>
  <DialogTitle data-slot="dialog-title" v-bind="forwardedProps" :class="props.class">
    <slot />
  </DialogTitle>
</template>

<script setup lang="ts">
import type { DialogTitleProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogTitle, useForwardProps } from "reka-ui"

const props = withDefaults(defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogTitleProps>
</script>

<style>
/* 面板标题：与 AlertDialogTitle 同一套字阶，下边距由面板统一给 */
:where([data-slot="dialog-title"]) {
  margin: 0;
  font-family: var(--font-sans);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
  color: var(--fg);
}
</style>
