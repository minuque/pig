<template>
  <ul class="subagent-list">
    <li v-for="(task, index) in tasks" :key="`${task.agent}:${index}`">
      <button
        type="button"
        class="subagent-row"
        :disabled="!task.sessionId || !rail"
        @click="task.sessionId && rail?.openChild({ sessionId: task.sessionId, agent: task.agent })"
      >
        <span class="subagent-dot" :data-status="task.status" />
        <span class="subagent-name">{{ task.agent }}</span>
        <span class="subagent-step">{{ task.error ?? task.steps.at(-1) ?? task.task }}</span>
      </button>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useSessionRail } from "@features/session-rail/index.js"
import { subagentTasks } from "@features/session-rail/lib/subagent.js"
import type { ToolCallView } from "@features/transcript-view/type.js"

const props = defineProps<{ call: ToolCallView }>()
const rail = useSessionRail()
const tasks = computed(() => subagentTasks(props.call.details))
</script>

<style scoped>
.subagent-list {
  display: grid;
  gap: var(--space-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.subagent-row {
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

.subagent-row:not(:disabled):hover {
  background: var(--btn-hover);
}

.subagent-row:disabled {
  cursor: default;
}

.subagent-dot {
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--contrast-foreground-faint);
  border-radius: var(--radius-pill);
}

.subagent-dot[data-status="running"] {
  background: var(--primary);
}

.subagent-dot[data-status="done"] {
  background: var(--success);
}

.subagent-dot[data-status="failed"] {
  background: var(--danger);
}

.subagent-name {
  font-size: var(--text-body);
  color: var(--contrast-foreground);
}

.subagent-step {
  min-inline-size: 0;
  overflow: hidden;
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
