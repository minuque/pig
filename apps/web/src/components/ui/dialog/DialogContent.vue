<template>
  <DialogPortal>
    <DialogOverlay />
    <DialogContent
      data-slot="dialog-content"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="
        cn(
          'bg-surface data-[state=open]:animate-[dialog-enter_var(--duration-slow)_var(--ease-out)] fixed top-1/2 left-1/2 z-(--z-modal) grid w-full max-w-[calc(100%-var(--spacing-xxl))] gap-(--spacing-md) rounded-(--radius-lg) border border-hairline p-(--spacing-lg) shadow-modal sm:max-w-(--size-modal)',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        v-if="showCloseButton"
        data-slot="dialog-close"
        class="data-[state=open]:bg-accent data-[state=open]:text-ink-muted absolute top-(--spacing-md) right-(--spacing-md) rounded-(--radius-xs) bg-transparent transition-colors duration-(--duration-fast) ease-(--ease-smooth) hover:text-ink focus:outline-hidden disabled:pointer-events-none"
      >
        <X :size="16" />
        <span class="sr-only">关闭</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>

<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { X } from "lucide-vue-next";
import { reactiveOmit } from "@vueuse/core";
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils.js";
import DialogOverlay from "./DialogOverlay.vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<
    DialogContentProps & { class?: HTMLAttributes["class"]; showCloseButton?: boolean }
  >(),
  {
    class: undefined,
    showCloseButton: true,
  },
);
const emits = defineEmits<DialogContentEmits>();

const delegatedProps = reactiveOmit(props, "class");

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<DialogContentProps>;
</script>
