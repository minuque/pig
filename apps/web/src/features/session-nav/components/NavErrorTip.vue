<template>
  <Tooltip v-if="message" :delay-duration="200">
    <TooltipTrigger as-child>
      <button type="button" class="icon-button nav-error-tip" aria-label="操作失败">
        <CircleAlert :size="16" aria-hidden="true" />
      </button>
    </TooltipTrigger>
    <TooltipContent class="max-w-[280px]">{{ message }}</TooltipContent>
  </Tooltip>
</template>

<script setup lang="ts">
import { CircleAlert } from "lucide-vue-next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js";

defineProps<{
  message: string;
}>();
</script>

<style scoped>
.nav-error-tip {
  display: grid;
  place-items: center;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.nav-error-tip:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
</style>
