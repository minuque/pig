<template>
  <AlertDialogDescription
    data-slot="alert-dialog-description"
    v-bind="forwardedProps"
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

<style scoped>
[data-slot="alert-dialog-description"] {
  max-height: min(24rem, 60dvh);
  min-height: 0;
  margin: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  color: var(--fg-secondary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  overflow-wrap: anywhere;
  user-select: text;
}
</style>
