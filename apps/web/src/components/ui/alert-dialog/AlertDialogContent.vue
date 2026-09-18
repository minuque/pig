<template>
  <AlertDialogPortal>
    <AlertDialogOverlay />

    <AlertDialogContent
      data-slot="alert-dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-surface text-body-md fixed bottom-0 inset-s-1/2 z-50 grid max-h-[calc(100dvh-3rem)] w-full gap-(--spacing-md) rounded-t-(--radius-xl) border border-border border-b-0 p-(--spacing-lg) shadow-(--shadow-modal) sm:top-[50%] sm:bottom-auto sm:max-w-(--size-modal) sm:rounded-(--radius-xl) sm:border-b"
      :class="props.class"
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>

<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogContent, AlertDialogPortal, useForwardPropsEmits } from "reka-ui"
import AlertDialogOverlay from "./AlertDialogOverlay.vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<AlertDialogContentProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
)
const emits = defineEmits<AlertDialogContentEmits>()
const delegatedProps = reactiveOmit(props, "class")
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<AlertDialogContentProps>
</script>
