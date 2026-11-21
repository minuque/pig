<template>
  <div class="demo-story">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<style scoped>
.demo-story {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}
</style>
