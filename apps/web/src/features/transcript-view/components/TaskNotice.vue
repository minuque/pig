<template>
  <p class="task-notice" :data-status="task.status">
    <component :is="icon" class="task-notice-icon" aria-hidden="true" />
    <span class="task-notice-label">{{ label }}</span>
    <span class="task-notice-text">{{ task.description }}</span>
    <span v-if="elapsed" class="task-notice-time">{{ elapsed }}</span>
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { CheckCircleIcon, DangerCircleIcon, StopIcon } from "@components/icons/index.js"
import { formatElapsed } from "@utils/time.js"
import type { Task } from "@/types/common-type.js"

const props = defineProps<{ task: Task }>()
const { t } = useI18n()
/** 时间线末尾的一行（照 t3code 的 ThreadNow）：图标、「后台命令已完成 · 描述」、耗时。 */
const label = computed(() => t(`taskNotice.${props.task.kind}.${props.task.status}`))
const icon = computed(() =>
  props.task.status === "completed"
    ? CheckCircleIcon
    : props.task.status === "failed"
      ? DangerCircleIcon
      : StopIcon,
)
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
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
  margin: 0;
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  color: var(--contrast-foreground-faint);
}

.task-notice-icon {
  flex: none;
  inline-size: var(--text-body);
  block-size: var(--text-body);
}

.task-notice-label {
  flex: none;
  color: var(--contrast-foreground-secondary);
}

.task-notice[data-status="failed"] :is(.task-notice-icon, .task-notice-label) {
  color: var(--danger);
}

.task-notice-text {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-notice-text::before {
  margin-inline-end: var(--space-xs);
  content: "·";
}

.task-notice-time {
  flex: none;
  margin-inline-start: var(--space-xs);
  font-variant-numeric: tabular-nums;
}
</style>
