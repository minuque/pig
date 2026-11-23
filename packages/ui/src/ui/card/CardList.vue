<template>
  <Card size="m" data-card-list>
    <slot />
  </Card>
</template>

<script setup lang="ts">
import Card from "./Card.vue"
</script>

<style>
[data-card-list] {
  --card-border-radius: var(--radius-dialog);
  display: flex;
  flex-direction: column;
  padding: var(--border-width);
}
</style>
