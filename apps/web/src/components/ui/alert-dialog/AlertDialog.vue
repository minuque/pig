<template>
  <AlertDialogRoot v-bind="$attrs">
    <slot />
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import { AlertDialog as AlertDialogRoot } from "@ui-sdk/vue/alert-dialog"

defineOptions({ inheritAttrs: false })
</script>
