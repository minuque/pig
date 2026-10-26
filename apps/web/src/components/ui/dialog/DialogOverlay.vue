<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="forwardedProps"
    class="rt-BaseDialogOverlay rt-DialogOverlay"
    :class="props.class"
  >
    <div class="rt-BaseDialogScroll rt-DialogScroll">
      <div class="rt-BaseDialogScrollPadding rt-DialogScrollPadding" :class="alignClass">
        <slot />
      </div>
    </div>
  </DialogOverlay>
</template>

<script setup lang="ts">
import type { DialogOverlayProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
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
const alignClass = computed(() =>
  props.align === "start" ? "rt-r-align-start" : "rt-r-align-center",
)
</script>
