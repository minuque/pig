<template>
  <AlertDialogClose
    value="confirm"
    v-bind="{ ...$attrs, ...buttonAttrs('solid') }"
    :data-tone="variant === 'destructive' ? 'danger' : undefined"
    :class="props.class"
  >
    <slot />
  </AlertDialogClose>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { AlertDialogClose } from "@ui-sdk/vue/alert-dialog"
import { buttonAttrs } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"]
    variant?: "default" | "destructive"
  }>(),
  { class: undefined, variant: "default" },
)
</script>
