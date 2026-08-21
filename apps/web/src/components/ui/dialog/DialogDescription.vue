<script setup lang="ts">
import type { DialogDescriptionProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DialogDescription, useForwardProps } from "reka-ui";
import { cn } from "@utils/utils.js";

const props = withDefaults(
  defineProps<DialogDescriptionProps & { class?: HTMLAttributes["class"] }>(),
  { class: undefined },
);

const delegatedProps = reactiveOmit(props, "class");

const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogDescriptionProps>;
</script>

<template>
  <DialogDescription
    data-slot="dialog-description"
    v-bind="forwardedProps"
    :class="cn('text-muted-foreground text-sm', props.class)"
  >
    <slot />
  </DialogDescription>
</template>
