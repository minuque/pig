<template>
  <AlertDialogOverlay
    data-slot="alert-dialog-overlay"
    v-bind="forwardedProps"
    class="reveal-overlay fixed inset-0 z-50 bg-[var(--scrim)]"
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
