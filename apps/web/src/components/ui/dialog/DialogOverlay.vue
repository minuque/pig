<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="forwardedProps"
    class="reveal-overlay"
    :class="props.class"
  >
    <div data-slot="dialog-scroll">
      <div data-slot="dialog-scroll-padding" :data-align="align">
        <slot />
      </div>
    </div>
  </DialogOverlay>
</template>

<script setup lang="ts">
import type { DialogOverlayProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogOverlay, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    DialogOverlayProps & { class?: HTMLAttributes["class"]; align?: "start" | "center" }
  >(),
  { class: undefined, align: "center" },
)
const delegatedProps = reactiveOmit(props, "class", "align")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogOverlayProps>
</script>

<style>
/* 遮罩铺满视口，内部滚动层撑满并居中；start 档贴顶对齐 */
:where([data-slot="dialog-overlay"]) {
  position: fixed;
  inset: 0;
  background-color: var(--black-a6);
}

html.dark :where([data-slot="dialog-overlay"]) {
  background-color: var(--black-a8);
}

:where([data-slot="dialog-scroll"]) {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: auto;
}

:where([data-slot="dialog-scroll-padding"]) {
  flex-grow: 1;
  margin: auto;
  padding-block: var(--space-2xl) max(var(--space-2xl), 6vh);
  padding-inline: var(--space-md);
}

:where([data-slot="dialog-scroll-padding"][data-align="start"]) {
  margin-block-start: 0;
}
</style>
