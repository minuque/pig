<template>
  <AlertDialogOverlay
    data-slot="alert-dialog-overlay"
    v-bind="forwardedProps"
    class="rt-BaseDialogOverlay rt-AlertDialogOverlay"
    :class="props.class"
  >
    <div class="rt-BaseDialogScroll rt-AlertDialogScroll">
      <div class="rt-BaseDialogScrollPadding rt-AlertDialogScrollPadding" :class="alignClass">
        <slot />
      </div>
    </div>
  </AlertDialogOverlay>
</template>

<script setup lang="ts">
import type { AlertDialogOverlayProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogOverlay, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<
    AlertDialogOverlayProps & { class?: HTMLAttributes["class"]; align?: "start" | "center" }
  >(),
  { class: undefined, align: "center" },
)
const delegatedProps = reactiveOmit(props, "class", "align")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogOverlayProps>
const alignClass = computed(() =>
  props.align === "start" ? "rt-r-align-start" : "rt-r-align-center",
)
</script>
