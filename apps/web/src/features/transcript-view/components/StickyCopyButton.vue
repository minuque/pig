<template>
  <div class="copy-pin">
    <span class="copy-backdrop"><CopyButton :text="text" /></span>
  </div>
</template>

<script setup lang="ts">
import CopyButton from "@features/transcript-view/components/CopyButton.vue"

defineProps<{ text: string }>()
</script>

<style scoped>
.copy-pin {
  position: sticky;
  top: 0;
  left: 0;
  flex: none;
  height: 0;
}

.copy-backdrop {
  position: absolute;
  top: calc(var(--space-2xs) - var(--space-xs));
  inset-inline-end: calc(var(--space-2xs) - var(--space-sm) - 22px);
  display: flex;
  border-radius: var(--radius-control);
  background:
    linear-gradient(var(--card-background-color), var(--card-background-color)), var(--bg);
  white-space: normal;
}

.copy-backdrop :deep(.copy-button) {
  position: static;
}
</style>
