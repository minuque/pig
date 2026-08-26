<template>
  <div class="earlier-row">
    <button type="button" :disabled="loading" @click="emit('load')">
      {{ loading ? "加载中…" : "加载更早" }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean
}>()

const emit = defineEmits<{
  load: []
}>()
</script>

<style scoped>
.earlier-row {
  display: flex;
  justify-content: center;
  padding: var(--spacing-sm) 0 var(--spacing-md);
}
.earlier-row button {
  min-height: var(--size-nav-action);
  padding: 4px 12px;
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}
.earlier-row button:hover:not(:disabled) {
  color: var(--ink);
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.earlier-row button:disabled {
  cursor: default;
  opacity: 0.7;
}
</style>
