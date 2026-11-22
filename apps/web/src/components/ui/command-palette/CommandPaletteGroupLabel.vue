<template>
  <CommandGroupLabel class="label"><slot /></CommandGroupLabel>
</template>

<script setup lang="ts">
import { CommandGroupLabel } from "@ui-sdk/vue/command"
</script>

<style scoped>
.label {
  padding: calc(var(--spacing) * 1.5) var(--space-xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}
</style>
