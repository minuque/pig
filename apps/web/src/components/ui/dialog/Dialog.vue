<template>
  <DialogRoot v-bind="$attrs">
    <slot />
  </DialogRoot>
</template>

<script setup lang="ts">
import { Dialog as DialogRoot } from "@ui-sdk/vue/dialog"

defineOptions({ inheritAttrs: false })
</script>
