<template>
  <Card size="m" data-card-list>
    <slot />
  </Card>
</template>

<script setup lang="ts">
import Card from "./Card.vue"
</script>

<style>
:where([data-card-list]) {
  --card-border-radius: var(--radius-card);
  display: flex;
  flex-direction: column;
  padding: 0;
}
</style>
