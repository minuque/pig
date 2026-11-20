<template>
  <DialogDescription data-slot="dialog-description" v-bind="forwardedProps" :class="props.class">
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

<style>
:where([data-slot="dialog-description"]) {
  margin: 0;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  color: var(--fg-secondary);
}
</style>
