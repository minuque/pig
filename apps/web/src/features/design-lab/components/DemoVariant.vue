<template>
  <section class="demo-variant">
    <h3 class="demo-variant-title">{{ title }}</h3>
    <div class="demo-variant-body"><slot /></div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style scoped>
.demo-variant {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.demo-variant-title {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
}

.demo-variant-body {
  padding: var(--space-md);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 var(--border-width) var(--border-soft);
}
</style>
