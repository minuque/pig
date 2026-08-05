<template>
  <div
    data-slot="dialog-header"
    :class="cn('flex flex-col gap-(--spacing-xs) text-center sm:text-left', props.class)"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/utils.js";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>
