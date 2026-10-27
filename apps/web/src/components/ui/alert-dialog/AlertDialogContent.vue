<template>
  <AlertDialogPortal>
    <ThemeRoot>
      <AlertDialogOverlay :align="align">
        <AlertDialogContent
          data-slot="alert-dialog-content"
          v-bind="{ ...$attrs, ...forwarded }"
          class="rt-BaseDialogContent rt-DialogContent"
          :class="[sizeClass, props.class]"
        >
          <slot />
        </AlertDialogContent>
      </AlertDialogOverlay>
    </ThemeRoot>
  </AlertDialogPortal>
</template>

<script setup lang="ts">
import type { AlertDialogContentEmits, AlertDialogContentProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogContent, AlertDialogPortal, useForwardPropsEmits } from "reka-ui"
import { ThemeRoot } from "@components/ui/rt/index.js"
import AlertDialogOverlay from "./AlertDialogOverlay.vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<
    AlertDialogContentProps & {
      class?: HTMLAttributes["class"]
      size?: "1" | "2" | "3" | "4"
      align?: "start" | "center"
    }
  >(),
  { class: undefined, size: "3", align: "center" },
)
const emits = defineEmits<AlertDialogContentEmits>()
const delegatedProps = reactiveOmit(props, "class", "size", "align")
const forwarded = useForwardPropsEmits(
  delegatedProps,
  emits,
) as ComputedRef<AlertDialogContentProps>
const sizeClass = `rt-r-size-${props.size}`
</script>
