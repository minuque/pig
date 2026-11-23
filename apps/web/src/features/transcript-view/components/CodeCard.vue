<template>
  <Card size="s" variant="surface" class="code-card"><slot /></Card>
</template>

<script setup lang="ts">
import { Card } from "@pig/ui/card"
</script>

<style scoped>
.code-card {
  --card-padding: 0;

  min-width: 0;
  color: var(--fg);
}
</style>
