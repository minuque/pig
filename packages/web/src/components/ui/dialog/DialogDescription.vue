<template>
  <DialogDescription
    data-slot="dialog-description"
    v-bind="forwardedProps"
    :class="cn('text-ink-muted text-caption', props.class)"
  >
    <slot />
  </DialogDescription>
</template>

<script setup lang="ts">
import type { DialogDescriptionProps } from "reka-ui";
import type { ComputedRef, HTMLAttributes } from "vue";
import { reactiveOmit } from "@vueuse/core";
import { DialogDescription, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils.js";

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes["class"] }>();

const delegatedProps = reactiveOmit(props, "class");

// reka-ui 的 WithOptionalBooleans 与 exactOptionalPropertyTypes 不兼容，cast 到组件 props 类型
const forwardedProps = useForwardProps(delegatedProps) as ComputedRef<DialogDescriptionProps>;
</script>
