<script setup lang="ts">
import type { DialogOverlayProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DialogOverlay, useForwardProps } from "reka-ui";
import { cn } from "@utils/utils.js";

const props = withDefaults(
  defineProps<DialogOverlayProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
);

const delegatedProps = reactiveOmit(props, "class");
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogOverlayProps>;
</script>

<template>
  <DialogOverlay
    data-slot="dialog-overlay"
    v-bind="forwardedProps"
    :class="cn('fixed inset-0 z-50 bg-[var(--scrim)]', props.class)"
  >
    <slot />
  </DialogOverlay>
</template>
