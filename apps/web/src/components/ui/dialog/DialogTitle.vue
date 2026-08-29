<script setup lang="ts">
import type { DialogTitleProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogTitle, useForwardProps } from "reka-ui"

const props = withDefaults(defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>(), {
  class: undefined,
})

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogTitleProps>
</script>

<template>
  <DialogTitle
    data-slot="dialog-title"
    v-bind="forwardedProps"
    class="text-title leading-none font-semibold"
    :class="props.class"
  >
    <slot />
  </DialogTitle>
</template>
