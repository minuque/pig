<template>
  <AlertDialogClose
    value="confirm"
    v-bind="{ ...$attrs, ...buttonAttrs('solid') }"
    :data-tone="color"
    :class="props.class"
  >
    <slot />
  </AlertDialogClose>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { AlertDialogClose } from "@ui-sdk/vue/alert-dialog"
import { buttonAttrs } from "../button/index.js"
import type { ToneColor } from "../../core/types.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    color?: ToneColor
  }>(),
  { class: undefined },
)
</script>
