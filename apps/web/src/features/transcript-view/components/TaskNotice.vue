<template>
  <p class="task-notice" :data-status="task.status">
    <span class="task-notice-label">{{ label }}</span>
    <span class="task-notice-text">{{ task.description }}</span>
    <span v-if="elapsed" class="task-notice-time">{{ elapsed }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { formatElapsed } from "@utils/time.js"
import type { Task } from "@/types/common-type.js"

const props = defineProps<{ task: Task }>()
const { t } = useI18n()
/** 一行通知：「后台命令已完成 · 描述 · 耗时」。 */
const label = computed(() => t(`taskNotice.${props.task.kind}.${props.task.status}`))
const elapsed = computed(() => {
  const { startedAt, completedAt } = props.task
  return startedAt !== undefined && completedAt !== undefined
    ? formatElapsed(completedAt - startedAt, { showMs: false })
    : ""
})
</script>

<style scoped>
.task-notice {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-inline-size: 0;
  margin: 0;
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
}

.task-notice-label {
  flex: none;
  color: var(--contrast-foreground-secondary);
}

.task-notice[data-status="failed"] .task-notice-label {
  color: var(--danger);
}

.task-notice-text {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-notice-text::before,
.task-notice-time::before {
  margin-inline-end: var(--space-xs);
  content: "·";
}

.task-notice-time {
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>
