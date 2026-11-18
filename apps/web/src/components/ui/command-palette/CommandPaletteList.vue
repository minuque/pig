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
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-xs);
  overflow-y: auto;
  scroll-padding-block: var(--space-xs);
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-width: thin;
}
</style>
