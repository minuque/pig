<template>
  <ListboxContent data-slot="command-palette-list">
    <slot />
  </ListboxContent>
</template>

<script setup lang="ts">
import { ListboxContent } from "reka-ui"
</script>

<style scoped>
[data-slot="command-palette-list"] {
  max-height: min(28rem, 70vh);
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-width: thin;
}

[data-slot="command-palette-list"]:not(:empty) {
  padding: var(--space-xs);
  scroll-padding-block: var(--space-xs);
}
</style>
