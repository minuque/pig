<script setup lang="ts">
import type { DialogTriggerProps } from "reka-ui";
import type { ComputedRef } from "vue";
import { DialogTrigger, useForwardProps } from "reka-ui";

const props = defineProps<DialogTriggerProps>();

const forwardedProps = useForwardProps(props) as ComputedRef<DialogTriggerProps>;
</script>

<template>
  <DialogTrigger data-slot="dialog-trigger" v-bind="forwardedProps">
    <slot />
  </DialogTrigger>
</template>
