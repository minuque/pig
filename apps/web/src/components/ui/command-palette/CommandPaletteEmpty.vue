<template>
  <CommandEmpty><slot /></CommandEmpty>
</template>

<script setup lang="ts">
import { CommandEmpty } from "@ui-sdk/vue/command"
</script>

<style>
:where([data-slot="command-empty"]) {
  margin: 0;
  padding-block: calc(var(--spacing) * 10);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  text-align: center;
}

:where([data-slot="command-empty"]:not([data-empty])) {
  display: none;
}
</style>
