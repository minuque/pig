<template>
  <CommandEmpty class="empty"><slot /></CommandEmpty>
</template>

<script setup lang="ts">
import { CommandEmpty } from "@ui-sdk/vue/command"
</script>

<style scoped>
.empty {
  margin: 0;
  padding-block: calc(var(--spacing) * 10);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  text-align: center;
}

.empty:not([data-empty]) {
  display: none;
}
</style>
