<template>
  <div ref="list" class="rail-cards">
    <RailCard
      v-for="id in shown"
      :id="id"
      :key="id"
      :title="titles[id]"
      :open="!rail.layout.value.closed.includes(id)"
      @toggle="rail.toggleOpen(id)"
      @toggle-all="rail.setAllOpen(rail.layout.value.closed.length > 0)"
      @nudge="(step) => nudge(id, step)"
    >
      <template #summary>
        <template v-if="id === 'environment'">{{ place.host ?? t("rail.local") }}</template>

        <template v-else-if="id === 'context' && usage">
          {{ usage.percent }}%
          <span class="rail-bar" data-mini aria-hidden="true">
            <i :style="{ inlineSize: `${usage.percent}%` }" />
          </span>
        </template>

        <template v-else-if="id === 'tasks' && tasks.length">
          {{ doneCount }}/{{ tasks.length }}
        </template>
      </template>

      <template #menu>
        <ContextMenuLabel>{{ t("rail.show") }}</ContextMenuLabel>

        <ContextMenuCheckboxItem
          v-for="item in RAIL_SECTIONS"
          :key="item"
          :model-value="!rail.layout.value.hidden.includes(item)"
          :disabled="shown.length === 1 && shown[0] === item"
          @update:model-value="rail.toggleHidden(item)"
        >
          {{ titles[item] }}
        </ContextMenuCheckboxItem>

        <ContextMenuSeparator />
        <ContextMenuItem @select="rail.setAllOpen(true)">{{ t("rail.expandAll") }}</ContextMenuItem>

        <ContextMenuItem @select="rail.setAllOpen(false)">
          {{ t("rail.collapseAll") }}
        </ContextMenuItem>
      </template>

      <template v-if="id === 'environment'">
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
      </template>

      <template v-else-if="id === 'context' && usage">
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
      </template>

      <template v-else-if="id === 'tasks'">
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
      </template>
    </RailCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { useDragReorder } from "@utils/motion.js"
import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@components/ui/context-menu/index.js"
import { formatTokenCount } from "@features/composer/lib/context-usage.js"
import type { ContextUsage } from "@features/composer/type.js"
import RailCard from "@features/session-rail/components/RailCard.vue"
import { useSessionRail, type OpenChild } from "@features/session-rail/index.js"
import { RAIL_SECTIONS, type RailSectionId } from "@features/session-rail/lib/sections.js"
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
const rail = useSessionRail()!
const titles = computed<Record<RailSectionId, string>>(() => ({
  environment: t("rail.environment"),
  context: t("rail.context"),
  tasks: t("rail.tasks"),
}))
const doneCount = computed(() => props.tasks.filter((task) => task.status === "done").length)
/** 远程 workspace 键 ssh://主机/路径 拆成主机与远端路径。 */
const place = computed(() => {
  const remote = props.cwd ? REMOTE_KEY.exec(props.cwd) : null
  return remote ? { host: remote[1], path: remote[2] || "/" } : { path: props.cwd }
})
const statusLines = computed(() => [...(props.statuses?.values() ?? [])].filter(Boolean))
/** 按存下的顺序排，去掉隐藏的和眼下没内容的。 */
const shown = computed(() =>
  rail.layout.value.order.filter((id) => {
    if (rail.layout.value.hidden.includes(id)) return false

    if (id === "context") return Boolean(props.usage)

    if (id === "tasks") return props.tasks.length > 0 || statusLines.value.length > 0
    return true
  }),
)
const list = useTemplateRef("list")
const reorder = useDragReorder({
  axis: "y",
  container: () => list.value,
  itemSelector: ".rail-card",
  handleSelector: ".rail-grip",
  onMove: (id, toIndex) => rail.move(shown.value, id as RailSectionId, toIndex),
})
let release: (() => void) | undefined

onMounted(() => {
  if (list.value) release = reorder.attach(list.value)
})

onBeforeUnmount(() => {
  release?.()
  reorder.detach()
})

/** 把手上按方向键也能挪位置。 */
function nudge(id: RailSectionId, step: number) {
  const to = shown.value.indexOf(id) + step

  if (to >= 0 && to < shown.value.length) rail.move(shown.value, id, to)
}

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

.rail-kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  min-block-size: var(--size-rail-row);
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
  margin-block: var(--space-xxs);
  overflow: hidden;
  background: var(--border-soft);
  border-radius: var(--radius-pill);
}

/* 收起时摘要里的小量表 */
.rail-bar[data-mini] {
  inline-size: var(--space-lg);
  margin-block: 0;
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
