<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import type { AlertVariants } from "./index.js";
import { cn } from "@utils/utils.js";
import { alertVariants } from "./index.js";

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes["class"];
    variant?: AlertVariants["variant"];
  }>(),
  {
    class: undefined,
    variant: "default",
  },
);
</script>

<template>
  <div data-slot="alert" :class="cn(alertVariants({ variant }), props.class)" role="alert">
    <slot />
  </div>
</template>
