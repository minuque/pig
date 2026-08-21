<template>
  <div
    data-slot="alert-description"
    :class="cn('text-ink-muted col-start-2 text-sm [&_p]:leading-relaxed', props.class)"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@utils/utils.js";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>
