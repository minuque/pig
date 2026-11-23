<template>
  <ul class="task-list">
    <li v-for="task in tasks" :key="task.id">
      <button
        type="button"
        class="task-row"
        :disabled="task.kind !== 'agent' || !task.sessionId || !openSession"
        @click="open(task)"
      >
        <StatusIndicator :status="TASK_STATUS_TONE[task.status] ?? 'idle'" size="m" />
        <span class="task-name">{{ task.description }}</span>
        <span class="task-step">{{ taskDetail(task) }}</span>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { inject } from "vue"
import { StatusIndicator, type StatusTone } from "@pig/ui/status-indicator"
import { openTaskSessionKey } from "@features/transcript-view/index.js"
import { taskDetail } from "@features/transcript-view/lib/tool-tasks.js"
import type { Task } from "@/types/common-type.js"

const TASK_STATUS_TONE: Record<Task["status"], StatusTone> = {
  running: "running",
  queued: "waiting",
  completed: "success",
  failed: "error",
  stopped: "idle",
}

defineProps<{ tasks: readonly Task[] }>()

const openSession = inject(openTaskSessionKey, undefined)

function open(task: Task) {
  if (task.kind === "agent" && task.sessionId)
    openSession?.({ sessionId: task.sessionId, agent: task.description })
}
</script>

<style scoped>
.task-list {
  display: grid;
  gap: var(--space-2xs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.task-row {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: var(--space-xs);
  inline-size: 100%;
  padding: var(--space-2xs) var(--space-xs);
  color: inherit;
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.task-row:not(:disabled):hover {
  background: var(--bg-hover);
}

.task-row:disabled {
  cursor: default;
}

.task-name {
  font-size: var(--text-body);
  color: var(--fg);
}

.task-step {
  min-inline-size: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--fg-secondary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
