<template>
  <DialogDescription
    data-slot="dialog-description"
    v-bind="forwardedProps"
    class="rt-Text rt-r-size-3"
    :class="props.class"
  >
    <slot />
  </DialogDescription>
</template>

<script setup lang="ts">
import type { DialogDescriptionProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogDescription, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<DialogDescriptionProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogDescriptionProps>
</script>
