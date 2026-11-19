<template>
  <AlertDialogTitle data-slot="alert-dialog-title" v-bind="forwardedProps" :class="props.class">
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

<style scoped>
[data-slot="alert-dialog-title"] {
  flex: none;
  margin: 0;
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
  overflow-wrap: anywhere;
}
</style>
