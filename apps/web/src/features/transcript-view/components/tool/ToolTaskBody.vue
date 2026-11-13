<template>
  <ul class="task-list">
    <li v-for="task in tasks" :key="task.id">
      <button
        type="button"
        class="task-row"
        :disabled="!task.sessionId || !openSession"
        @click="open(task)"
      >
        <span class="task-dot" :data-status="task.status" />
        <span class="task-name">{{ task.description }}</span>
        <span class="task-step">{{ task.error ?? task.steps.at(-1) ?? task.prompt }}</span>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { inject } from "vue"
import { openTaskSessionKey } from "@features/transcript-view/index.js"
import type { Task } from "@/types/common-type.js"

defineProps<{ tasks: readonly Task[] }>()

const openSession = inject(openTaskSessionKey, undefined)

function open(task: Task) {
  if (task.sessionId) openSession?.({ sessionId: task.sessionId, agent: task.description })
}
</script>

<style scoped>
.task-list {
  display: grid;
  gap: var(--space-xxs);
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
  padding: var(--space-xxs) var(--space-xs);
  color: inherit;
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.task-row:not(:disabled):hover {
  background: var(--btn-hover);
}

.task-row:disabled {
  cursor: default;
}

.task-dot {
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--contrast-foreground-faint);
  border-radius: var(--radius-pill);
}

.task-dot[data-status="running"] {
  background: var(--primary);
}

.task-dot[data-status="completed"] {
  background: var(--success);
}

.task-dot[data-status="failed"] {
  background: var(--danger);
}

.task-name {
  font-size: var(--text-body);
  color: var(--contrast-foreground);
}

.task-step {
  min-inline-size: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
