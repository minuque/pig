<template>
  <DialogPortal>
    <ThemeRoot>
      <DialogOverlay :align="align" :style="widthStyle">
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
            class="dlg-close rt-reset rt-BaseButton rt-IconButton rt-variant-ghost rt-r-size-1"
            data-accent-color="gray"
          >
            <CloseIcon class="size-icon" />
          </DialogClose>
        </DialogContent>
      </DialogOverlay>
    </ThemeRoot>
  </DialogPortal>
</template>

<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { computed } from "vue"
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
      /** 面板最大宽度，默认沿用 rt 的 600px；调用方的 scoped 类仍可覆盖 */
      maxWidth?: string
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
const delegatedProps = reactiveOmit(props, "class", "showCloseButton", "size", "maxWidth", "align")
const forwarded = useForwardPropsEmits(delegatedProps, emits) as ComputedRef<DialogContentProps>
const sizeClass = `rt-r-size-${props.size}`
const widthStyle = computed(() =>
  props.maxWidth ? { "--dialog-max-width": props.maxWidth } : undefined,
)
</script>

<style scoped>
/* 只留定位：尺寸、配色、悬停与焦点环由 rt 的图标按钮类承担。 */
.dlg-close {
  position: absolute;
  inset-block-start: var(--space-md);
  inset-inline-end: var(--space-md);
}
</style>
