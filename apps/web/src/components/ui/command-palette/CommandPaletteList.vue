<template>
  <CommandList class="list">
    <slot />
  </CommandList>
</template>

<script setup lang="ts">
import { CommandList } from "@ui-sdk/vue/command"
</script>

<style scoped>
.list {
  max-height: min(28rem, 70vh);
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-width: thin;
}

.list:not(:empty) {
  padding: var(--space-xs);
  scroll-padding-block: var(--space-xs);
}
</style>
