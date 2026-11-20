<template>
  <DialogPortal>
    <DialogOverlay :align="align" :style="widthStyle">
      <DialogContent
        data-slot="dialog-content"
        :data-size="size"
        v-bind="{ ...$attrs, ...forwarded }"
        :class="props.class"
      >
        <slot />

        <DialogClose
          v-if="showCloseButton"
          data-button
          data-slot="icon-button"
          data-size="s"
          data-variant="ghost"
          data-tone="neutral"
          :aria-label="t('common.close')"
          class="dlg-close"
        >
          <XIcon class="size-icon" />
        </DialogClose>
      </DialogContent>
    </DialogOverlay>
  </DialogPortal>
</template>

<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import type { Size } from "@/types/ui-type.js"
import { XIcon } from "@components/icons/index.js"
import DialogOverlay from "./DialogOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes["class"]
      showCloseButton?: boolean
      /** 面板宽度与内边距档：s / m / l */
      size?: Size
      /** 面板最大宽度，默认沿用 rt 的 600px；调用方的 scoped 类仍可覆盖 */
      maxWidth?: string
      align?: "start" | "center"
    }
  >(),
  {
    class: undefined,
    showCloseButton: true,
    size: "m",
    align: "center",
  },
)
const emits = defineEmits<DialogContentEmits>()
const { t } = useI18n()
const delegatedProps = reactiveOmit(props, "class", "showCloseButton", "size", "maxWidth", "align")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<DialogContentProps>
const widthStyle = computed(() =>
  props.maxWidth ? { "--dialog-max-width": props.maxWidth } : undefined,
)
</script>

<style>
/* 面板：主区底色与圆角同心，尺寸档只改内边距、圆角与最大宽度 */
:where([data-slot="dialog-content"]) {
  position: relative;
  z-index: var(--z-raise);
  box-sizing: border-box;
  width: 100%;
  margin: auto;
  overflow: auto;
  max-inline-size: var(--dialog-max-width, 600px);
  padding: var(--space-md);
  border-radius: var(--radius-dialog);
  background-color: var(--bg);
  box-shadow: var(--shadow-dialog);
  outline: none;
}

:where([data-slot="dialog-content"][data-size="s"]) {
  max-inline-size: var(--dialog-max-width, var(--dialog-width-sm));
  padding: var(--space-sm);
  border-radius: var(--radius-card);
}

:where([data-slot="dialog-content"][data-size="l"]) {
  max-inline-size: var(--dialog-max-width, 720px);
  padding: var(--space-lg);
}

:where([data-slot="dialog-content"] [data-slot="dialog-title"]) {
  margin-block-end: var(--space-sm);
}
</style>

<style scoped>
/* 关闭按钮：图标边缘与内容边缘对齐，偏移 = 内边距 -（按钮宽 - 图标宽）/ 2 */
.dlg-close {
  position: absolute;
  inset-block-start: calc(var(--space-md) - (var(--space-lg) - var(--icon-md)) / 2);
  inset-inline-end: calc(var(--space-md) - (var(--space-lg) - var(--icon-md)) / 2);
}

[data-size="s"] > .dlg-close {
  inset-block-start: calc(var(--space-sm) - (var(--space-lg) - var(--icon-md)) / 2);
  inset-inline-end: calc(var(--space-sm) - (var(--space-lg) - var(--icon-md)) / 2);
}

[data-size="l"] > .dlg-close {
  inset-block-start: calc(var(--space-lg) - (var(--space-lg) - var(--icon-md)) / 2);
  inset-inline-end: calc(var(--space-lg) - (var(--space-lg) - var(--icon-md)) / 2);
}
</style>
