<template>
  <AlertDialogOverlay
    data-slot="alert-dialog-overlay"
    v-bind="forwardedProps"
    class="fixed inset-0 z-50 bg-[var(--scrim)] opacity-0 backdrop-blur-[var(--scrim-blur)] transition-opacity duration-(--duration-fast) ease-(--ease-out) data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-fade_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none"
    :class="props.class"
  >
    <slot />
  </AlertDialogOverlay>
</template>

<script setup lang="ts">
import type { AlertDialogOverlayProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogOverlay, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<AlertDialogOverlayProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogOverlayProps>
</script>
