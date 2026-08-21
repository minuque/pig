<script setup lang="ts">
import type { DialogCloseProps } from "reka-ui";
import type { ComputedRef } from "vue";
import { DialogClose, useForwardProps } from "reka-ui";

const props = defineProps<DialogCloseProps>();

const forwardedProps = useForwardProps(props) as ComputedRef<DialogCloseProps>;
</script>

<template>
  <DialogClose data-slot="dialog-close" v-bind="forwardedProps">
    <slot />
  </DialogClose>
</template>
