<template>
  <AlertDialogTitle
    data-slot="alert-dialog-title"
    v-bind="forwardedProps"
    class="rt-Heading rt-r-size-5 rt-r-trim-start rt-AlertDialogTitle"
    :class="props.class"
  >
    <slot />
  </AlertDialogTitle>
</template>

<script setup lang="ts">
import type { AlertDialogTitleProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogTitle, useForwardProps } from "reka-ui"

const props = withDefaults(
  defineProps<AlertDialogTitleProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const delegatedProps = reactiveOmit(props, "class")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogTitleProps>
</script>
