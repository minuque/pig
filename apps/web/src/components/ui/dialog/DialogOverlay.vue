<script setup lang="ts">
import type { DialogOverlayProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogOverlay, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DialogOverlayProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)

const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogOverlayProps>
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="forwardedProps"
    class="fixed inset-0 z-50 bg-[var(--scrim)] opacity-0 backdrop-blur-[var(--scrim-blur)] transition-opacity duration-(--duration-fast) ease-(--ease-out) data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
    :class="props.class"
  >
    <slot />
  </DialogOverlay>
</template>

<style scoped>
@media (prefers-reduced-transparency: reduce) {
  [data-slot="dialog-overlay"] {
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
