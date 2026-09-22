<template>
  <div class="nav-toolbar">
    <button class="nav-action" type="button" @click="emit('create')">
      <CirclePlus class="size-icon" />
      <span class="nav-label">新建会话</span>
    </button>

    <button class="nav-action" type="button" @click="emit('search')">
      <Search class="size-icon" />
      <span class="nav-label">搜索</span>
      <kbd class="search-shortcut">Ctrl K</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
import { CirclePlus, Search } from "@lucide/vue"

const emit = defineEmits<{
  create: []
  search: []
}>()
</script>

<style scoped>
.nav-toolbar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xxs);
}

.nav-action {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--size-nav-rail);
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  text-align: start;
  transition: background-color var(--duration-fast) var(--ease-out);
}

.nav-action:hover {
  background: var(--hover-quiet);
}

.nav-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-shortcut {
  flex: none;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  font: var(--text-caption-mono) / var(--text-caption-mono--line-height) var(--font-mono);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.nav-action:hover .search-shortcut,
.nav-action:focus-visible .search-shortcut {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .nav-action,
  .search-shortcut {
    transition: none;
  }
}
</style>
