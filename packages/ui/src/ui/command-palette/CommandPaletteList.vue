<template>
  <CommandList>
    <slot />
  </CommandList>
</template>

<script setup lang="ts">
import { CommandList } from "@ui-sdk/vue/command"
</script>

<style>
:where([data-slot="command-list"]) {
  max-height: min(28rem, 70vh);
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-width: thin;
}

:where([data-slot="command-list"]:not(:empty)) {
  padding: var(--space-xs);
  scroll-padding-block: var(--space-xs);
}
</style>
