<template>
  <section class="pane">
    <p class="empty">暂无用量数据</p>
  </section>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
