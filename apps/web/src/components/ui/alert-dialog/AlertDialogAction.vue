<template>
  <AlertDialogAction
    data-slot="alert-dialog-action"
    v-bind="forwardedProps"
    :class="[rtButtonClass('solid'), variant === 'destructive' && 'btn-destructive', props.class]"
  >
    <slot />
  </AlertDialogAction>
</template>

<script setup lang="ts">
import type { AlertDialogActionProps } from "reka-ui"
import type { ComputedRef, HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { AlertDialogAction, useForwardProps } from "reka-ui"
import { rtButtonClass } from "@components/ui/button/index.js"

const props = withDefaults(
  defineProps<
    AlertDialogActionProps & {
      class?: HTMLAttributes["class"]
      variant?: "default" | "destructive"
    }
  >(),
  { class: undefined, variant: "default" },
)
const delegatedProps = reactiveOmit(props, "class", "variant")
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<AlertDialogActionProps>
</script>
