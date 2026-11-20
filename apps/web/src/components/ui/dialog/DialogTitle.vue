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
/* 面板标题：20px 半粗，下边距由面板统一给 */
:where([data-slot="dialog-title"]) {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 20px;
  font-weight: var(--font-weight-bold);
  line-height: 26px;
  color: var(--fg);
}
</style>
