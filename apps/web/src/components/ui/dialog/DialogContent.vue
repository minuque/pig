<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { X } from "lucide-vue-next"
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
      class="bg-background fixed bottom-0 left-[50%] z-50 grid max-h-[calc(100dvh-3rem)] w-full translate-y-4 gap-4 rounded-t-(--radius-xl) border border-hairline border-b-0 p-6 opacity-0 shadow-(--shadow-modal) transition-[translate,opacity] duration-(--duration-normal) ease-(--ease-out) data-[state=open]:translate-y-0 data-[state=open]:opacity-100 data-[state=closed]:animate-[exit-soft_var(--duration-fast)_var(--ease-out)] motion-reduce:transition-none motion-reduce:data-[state=closed]:animate-none sm:top-[50%] sm:bottom-auto sm:max-w-(--size-modal) sm:translate-y-1.5 sm:rounded-(--radius-xl) sm:border-b sm:data-[state=open]:translate-y-0"
      :class="props.class"
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      >
        <X />
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
