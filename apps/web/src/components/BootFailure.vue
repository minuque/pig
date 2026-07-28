<script setup lang="ts">
/**
 * Full-screen boot failure surface: the Gateway is unreachable, or the
 * one-time bootstrap link was consumed/expired. Retry is offered only when
 * reconnecting can succeed without a fresh bootstrap link.
 */
defineProps<{ title: string; detail: string; retryable: boolean }>();
const emit = defineEmits<{ retry: [] }>();
</script>

<template>
  <main class="boot-failure">
    <div class="boot-failure-card" role="alert">
      <h1 class="boot-failure-title">{{ title }}</h1>
      <p class="boot-failure-detail">{{ detail }}</p>
      <button v-if="retryable" type="button" class="btn btn-primary" @click="emit('retry')">
        重试
      </button>
    </div>
  </main>
</template>

<style scoped>
.boot-failure {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.boot-failure-card {
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-6);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-panel);
  background: var(--color-surface);
}

.boot-failure-title {
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.boot-failure-detail {
  color: var(--color-foreground-muted);
  line-height: var(--line-reading);
}
</style>
