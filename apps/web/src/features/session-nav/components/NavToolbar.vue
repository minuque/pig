<template>
  <div class="nav-toolbar">
    <button class="search-button press-scale" type="button" @click="emit('search')">
      <Search class="size-icon" />
      <span class="search-label">搜索会话</span>
      <kbd class="search-shortcut">Ctrl K</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Search } from "@lucide/vue"

const emit = defineEmits<{
  search: []
}>()
</script>

<style scoped>
.nav-toolbar {
  flex: none;
}

.search-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs) var(--spacing-sm);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--ink-muted);
  text-align: start;
  transition:
    border-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out),
    scale var(--duration-fast) var(--ease-out);
}
.search-button:hover {
  border-color: var(--ink-faint);
  color: var(--ink);
}

.search-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-shortcut {
  flex: none;
  padding: 1px var(--spacing-xxs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-xs);
  background: var(--canvas-soft);
  color: var(--ink-faint);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
}

@media (prefers-reduced-motion: reduce) {
  .search-button {
    transition: none;
  }
}
</style>
