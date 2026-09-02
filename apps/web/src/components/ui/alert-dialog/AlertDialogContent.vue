<template>
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogContent
      data-slot="alert-dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-popover fixed bottom-0 left-[50%] z-50 grid max-h-[calc(100dvh-3rem)] w-full translate-y-4 gap-(--spacing-md) rounded-t-(--radius-xl) border border-hairline border-b-0 p-(--spacing-lg) opacity-0 shadow-(--shadow-modal) transition-[translate,opacity] duration-(--duration-normal) ease-(--ease-out) data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-soft_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none sm:top-[50%] sm:bottom-auto sm:max-w-(--size-modal) sm:translate-y-1.5 sm:rounded-(--radius-xl) sm:border-b sm:data-[state=open]:translate-y-0"
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

<style scoped>
/* Tailwind translate-* 走 translate 属性，与 keyframes 的 transform 叠加会双重偏移 */
:deep([data-slot="alert-dialog-content"]) {
  transform: translate(-50%, -50%);
}
@media (max-width: 639px) {
  :deep([data-slot="alert-dialog-content"]) {
    transform: translateX(-50%);
  }
}
</style>
