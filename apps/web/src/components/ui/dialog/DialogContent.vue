<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { X } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui"
import DialogOverlay from "./DialogOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DialogContentProps & { class?: HTMLAttributes["class"]; showCloseButton?: boolean }
  >(),
  {
    class: undefined,
    showCloseButton: true,
  },
)
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<DialogContentProps>
</script>

<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      class="bg-surface text-body-md fixed bottom-0 left-[50%] z-50 grid max-h-[calc(100dvh-3rem)] w-full gap-(--spacing-md) rounded-t-(--radius-xl) border border-hairline border-b-0 p-(--spacing-lg) shadow-(--shadow-modal) sm:top-[50%] sm:bottom-auto sm:max-w-(--size-modal) sm:rounded-(--radius-xl) sm:border-b"
      :class="props.class"
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="text-ink-muted hover:bg-accent hover:text-ink absolute top-(--spacing-md) right-(--spacing-md) flex size-(--size-icon-button) cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 transition-[background-color,color] duration-(--duration-fast) ease-(--ease-out) focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-(--size-icon)"
      >
        <X />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
