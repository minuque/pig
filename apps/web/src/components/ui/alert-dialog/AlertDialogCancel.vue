<template>
  <AlertDialogCancel
    data-slot="alert-dialog-cancel"
    v-bind="forwardedProps"
    :class="[rtButtonClass('outline'), props.class]"
  >
    <slot />
  </AlertDialogCancel>
</template>

<script setup lang="ts">
import type { AlertDialogCancelProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogCancel, useForwardProps } from "reka-ui"
import { rtButtonClass } from "@components/ui/button/index.js"

const props = withDefaults(
  defineProps<AlertDialogCancelProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogCancelProps>
</script>
