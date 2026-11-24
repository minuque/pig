<template>
  <DialogBackdrop class="reveal-overlay" />

  <DialogContentPrimitive
    :data-size="size"
    :data-align="align"
    v-bind="$attrs"
    :class="props.class"
    :style="widthStyle"
  >
    <slot />

    <DialogClose v-if="showCloseButton" as-child>
      <IconButton
        size="s"
        variant="ghost"
        color="neutral"
        :aria-label="labels.close"
        data-dialog-close
      >
        <XIcon class="size-icon" />
      </IconButton>
    </DialogClose>
  </DialogContentPrimitive>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { XIcon } from "@lucide/vue"
import { DialogBackdrop, DialogContent as DialogContentPrimitive } from "@ui-sdk/vue/dialog"
import { useUiLabels } from "../../core/config.js"
import type { Size } from "../../core/types.js"
import { IconButton } from "../button/index.js"
import DialogClose from "./DialogClose.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    showCloseButton?: boolean
    size?: Size
    maxWidth?: string
    align?: "start" | "center"
  }>(),
  {
    class: undefined,
    showCloseButton: true,
    size: "m",
    align: "center",
  },
)
const labels = useUiLabels()
const widthStyle = computed(() =>
  props.maxWidth ? { "--dialog-max-width": props.maxWidth } : undefined,
)
</script>

<style>
:where([data-slot="dialog-backdrop"]) {
  position: fixed;
  inset: 0;
  background-color: var(--overlay);
}

:where([data-slot="dialog-content"]) {
  position: fixed;
  inset-block: var(--space-2xl) max(var(--space-2xl), 6vh);
  inset-inline: var(--space-md);
  box-sizing: border-box;
  block-size: fit-content;
  max-block-size: calc(100dvh - var(--space-2xl) - max(var(--space-2xl), 6vh));
  max-inline-size: var(--dialog-max-width, 600px);
  margin: auto;
  overflow: auto;
  overscroll-behavior: contain;
  padding: var(--space-md);
  border-radius: var(--radius-dialog);
  background-color: var(--bg);
  box-shadow: var(--shadow-dialog);
  color: var(--fg);
  outline: none;
}

:where([data-slot="dialog-content"][data-align="start"]) {
  margin-block-start: 0;
}

:where([data-slot="dialog-content"][data-size="s"]) {
  max-inline-size: var(--dialog-max-width, var(--dialog-width-sm));
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="dialog-content"] [data-slot="dialog-title"]) {
  margin-block-end: var(--space-sm);
}

:where([data-slot="dialog-content"]) > [data-dialog-close] {
  position: absolute;
  inset-block-start: calc(var(--space-md) - (var(--space-lg) - var(--icon-md)) / 2);
  inset-inline-end: calc(var(--space-md) - (var(--space-lg) - var(--icon-md)) / 2);
}

:where([data-slot="dialog-content"][data-size="s"]) > [data-dialog-close] {
  inset-block-start: calc(var(--space-sm) - (var(--space-lg) - var(--icon-md)) / 2);
  inset-inline-end: calc(var(--space-sm) - (var(--space-lg) - var(--icon-md)) / 2);
}
</style>
