<template>
  <AlertDialogPortal>
    <ThemeRoot>
      <AlertDialogOverlay class="glass-backdrop" />

      <div class="viewport">
        <AlertDialogContent
          data-slot="alert-dialog-content"
          v-bind="{ ...$attrs, ...forwarded }"
          class="glass-panel"
          :class="props.class"
        >
          <slot />
        </AlertDialogContent>
      </div>
    </ThemeRoot>
  </AlertDialogPortal>
</template>

<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import {
  AlertDialogContent,
  AlertDialogOverlay,
  AlertDialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"

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
/* 上下各一份弹性空白，面板垂直居中且矮窗口里不顶出屏幕 */
.viewport {
  position: fixed;
  z-index: var(--z-modal);
  inset: 0;
  display: grid;
  grid-template-rows: 1fr auto 1fr;
  justify-items: center;
  padding: var(--space-md);
  pointer-events: none;
}

[data-slot="alert-dialog-content"] {
  display: flex;
  grid-row-start: 2;
  flex-direction: column;
  width: 100%;
  max-width: 32rem;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  pointer-events: auto;
}
</style>
