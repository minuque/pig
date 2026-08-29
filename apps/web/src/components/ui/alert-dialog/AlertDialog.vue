<template>
  <AlertDialogRoot v-slot="slotProps" data-slot="alert-dialog" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import type { AlertDialogEmits, AlertDialogProps } from "reka-ui"
import type { ComputedRef } from "vue"
import { AlertDialogRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<AlertDialogProps>()
const emits = defineEmits<AlertDialogEmits>()
const forwarded = useForwardPropsEmits(props, emits) as ComputedRef<AlertDialogProps>
</script>
