<template>
  <AlertDialogDescription
    data-slot="alert-dialog-description"
    v-bind="forwardedProps"
    class="rt-Text rt-r-size-3"
    :class="props.class"
  >
    <slot />
  </AlertDialogDescription>
</template>

<script setup lang="ts">
import type { AlertDialogDescriptionProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogDescription, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<AlertDialogDescriptionProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogDescriptionProps>
</script>
