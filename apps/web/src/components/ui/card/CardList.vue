<template>
  <Card size="m" class="card-list">
    <slot />
  </Card>
</template>

<script setup lang="ts">
import Card from "./Card.vue"
</script>

<style>
.card-list {
  --card-border-radius: var(--radius-dialog);
  display: flex;
  flex-direction: column;
  padding: var(--border-width);
}
</style>
