<template>
  <AlertDialogClose v-bind="{ ...$attrs, ...buttonAttrs('outline') }" data-tone="neutral">
    <slot />
  </AlertDialogClose>
</template>

<script setup lang="ts">
import { AlertDialogClose } from "@ui-sdk/vue/alert-dialog"
import { buttonAttrs } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })
</script>
