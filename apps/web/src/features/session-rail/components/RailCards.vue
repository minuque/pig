<template>
  <div class="rail-cards">
    <section class="rail-card">
      <h4 class="rail-title">{{ t("rail.environment") }}</h4>

      <div class="rail-kv">
        <span>{{ t("rail.location") }}</span>
        <span class="rail-value">{{ place.host ?? t("rail.local") }}</span>
      </div>

      <div v-if="place.path" class="rail-kv">
        <span>{{ t("rail.cwd") }}</span>
        <span class="rail-value" :title="place.path">{{ place.path }}</span>
      </div>

      <div v-if="model" class="rail-kv">
        <span>{{ t("rail.model") }}</span>
        <span class="rail-value">{{ model }}</span>
      </div>
    </section>

    <section v-if="usage" class="rail-card">
      <h4 class="rail-title">Context</h4>

      <div
        class="rail-bar"
        role="meter"
        :aria-valuenow="usage.percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <i :style="{ inlineSize: `${usage.percent}%` }" />
      </div>

      <div class="rail-kv">
        <span>{{ t("rail.used") }}</span>

        <span class="rail-value">
          {{ formatTokenCount(usage.used) }} / {{ formatTokenCount(usage.window) }} ·
          {{ usage.percent }}%
        </span>
      </div>
    </section>

    <section v-if="tasks.length || statusLines.length" class="rail-card">
      <h4 class="rail-title">
        <span>Task</span>
        <span v-if="tasks.length">{{ doneCount }}/{{ tasks.length }}</span>
      </h4>

      <button
        v-for="(task, index) in tasks"
        :key="`${task.agent}:${index}`"
        type="button"
        class="rail-task"
        :disabled="!task.sessionId"
        @click="task.sessionId && emit('open', { sessionId: task.sessionId, agent: task.agent })"
      >
        <span class="rail-dot" :data-status="task.status" />
        <span class="rail-task-name">{{ task.agent }}</span>
        <span class="rail-task-meta">{{ taskMeta(task) }}</span>
        <span class="rail-task-step">{{ task.error ?? task.steps.at(-1) ?? task.task }}</span>
      </button>

      <div v-for="line in statusLines" :key="line" class="rail-status">{{ line }}</div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { formatTokenCount } from "@features/composer/lib/context-usage.js"
import type { ContextUsage } from "@features/composer/type.js"
import type { OpenChild } from "@features/session-rail/index.js"
import type { SubagentTask } from "@features/session-rail/lib/subagent.js"

const REMOTE_KEY = /^ssh:[/][/]([^/]+)([/].*)?$/
const props = defineProps<{
  cwd: string | undefined
  model: string | undefined
  usage: ContextUsage | undefined
  tasks: readonly SubagentTask[]
  statuses: ReadonlyMap<string, string> | undefined
}>()
const emit = defineEmits<{ open: [child: OpenChild] }>()
const { t } = useI18n()
const doneCount = computed(() => props.tasks.filter((task) => task.status === "done").length)
/** 远程 workspace 键 ssh://主机/路径 拆成主机与远端路径。 */
const place = computed(() => {
  const remote = props.cwd ? REMOTE_KEY.exec(props.cwd) : null
  return remote ? { host: remote[1], path: remote[2] || "/" } : { path: props.cwd }
})
const statusLines = computed(() => [...(props.statuses?.values() ?? [])].filter(Boolean))

function taskMeta(task: SubagentTask): string {
  if (task.status === "queued") return t("rail.queued")

  if (task.status === "failed") return t("rail.failed")

  if (task.status === "aborted") return t("rail.aborted")
  return task.tokens > 0 ? formatTokenCount(task.tokens) : ""
}
</script>

<style scoped>
.rail-cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-xs);
}

.rail-card {
  min-inline-size: 0;
  padding: var(--space-xs) var(--space-sm);
  background: var(--surface);
  border-radius: var(--radius-card);
  box-shadow: 0 0 0 1px var(--border-soft);
}

.rail-title {
  display: flex;
  justify-content: space-between;
  margin: 0 0 var(--space-xxs);
  font-size: var(--text-meta);
  font-weight: 500;
  color: var(--contrast-foreground-faint);
}

.rail-kv {
  display: flex;
  justify-content: space-between;
  gap: var(--space-xs);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-secondary);
  white-space: nowrap;
}

.rail-value {
  min-width: 0;
  overflow: hidden;
  color: var(--contrast-foreground);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-bar {
  block-size: var(--space-xxs);
  margin-block: var(--space-xs);
  overflow: hidden;
  background: var(--border-soft);
  border-radius: var(--radius-pill);
}

.rail-bar i {
  display: block;
  block-size: 100%;
  background: var(--primary);
}

.rail-task {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0 var(--space-xs);
  inline-size: 100%;
  padding: var(--space-xxs) 0;
  color: inherit;
  text-align: start;
  background: none;
  border: 0;
  border-block-start: 1px solid var(--border-soft);
  cursor: pointer;
}

.rail-task:first-of-type {
  border-block-start: 0;
}

.rail-task:disabled {
  cursor: default;
}

.rail-task:not(:disabled):hover .rail-task-name {
  color: var(--link);
}

.rail-dot {
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--contrast-foreground-faint);
  border-radius: var(--radius-pill);
}

.rail-dot[data-status="running"] {
  background: var(--primary);
}

.rail-dot[data-status="done"] {
  background: var(--success);
}

.rail-dot[data-status="failed"] {
  background: var(--danger);
}

.rail-task-name {
  font-size: var(--text-body);
  color: var(--contrast-foreground);
}

.rail-task-meta,
.rail-task-step,
.rail-status {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
}

.rail-task-step {
  grid-column: 2 / 4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
