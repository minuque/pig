<template>
  <DialogPortal>
    <ThemeRoot>
      <DialogOverlay :align="align">
        <DialogContent
          data-slot="dialog-content"
          v-bind="{ ...$attrs, ...forwarded }"
          class="rt-BaseDialogContent rt-DialogContent"
          :class="[sizeClass, props.class]"
        >
          <slot />

          <DialogClose
            v-if="showCloseButton"
            data-slot="dialog-close"
            :aria-label="t('common.close')"
            class="dlg-close"
          >
            <CloseIcon />
          </DialogClose>
        </DialogContent>
      </DialogOverlay>
    </ThemeRoot>
  </DialogPortal>
</template>

<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogClose, DialogContent, DialogPortal, useForwardPropsEmits } from "reka-ui"
import { useI18n } from "@i18n/index.js"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { CloseIcon } from "@components/icons/index.js"
import DialogOverlay from "./DialogOverlay.vue"

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(
  defineProps<
    DialogContentProps & {
      class?: HTMLAttributes["class"]
      showCloseButton?: boolean
      /** Radix Themes 的面板宽度档：1 最窄、4 最宽 */
      size?: "1" | "2" | "3" | "4"
      align?: "start" | "center"
    }
  >(),
  {
    class: undefined,
    showCloseButton: true,
    size: "3",
    align: "center",
  },
)
const emits = defineEmits<DialogContentEmits>()
const { t } = useI18n()
const delegatedProps = reactiveOmit(props, "class", "showCloseButton", "size", "align")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<DialogContentProps>
const sizeClass = `rt-r-size-${props.size}`
</script>

<style scoped>
/* 关闭按钮：跟着面板右上角，颜色从 token 取 */
.dlg-close {
  position: absolute;
  inset-block-start: var(--space-md);
  inset-inline-end: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.dlg-close:hover {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
}

.dlg-close svg {
  inline-size: var(--size-icon);
  block-size: var(--size-icon);
}
</style>
