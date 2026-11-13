<template>
  <div class="rail-tasks">
    <template v-for="section in sections" :key="section.id">
      <div v-if="section.tasks.length" class="rail-tasks-head">
        <span>{{ section.title }}</span>

        <Tooltip v-if="section.id === 'finished'">
          <TooltipTrigger as-child>
            <IconButton
              class="rail-tasks-clear"
              type="button"
              size="s"
              variant="ghost"
              :aria-label="t('rail.clearFinished')"
              @click="clearFinished"
            >
              <TrashBinMinimalisticIcon aria-hidden="true" />
            </IconButton>
          </TooltipTrigger>

          <TooltipContent>{{ t("rail.clearFinished") }}</TooltipContent>
        </Tooltip>
      </div>

      <article
        v-for="task in section.tasks"
        :key="task.id"
        class="rail-task"
        :data-status="task.status"
        :data-kind="task.kind"
      >
        <div class="rail-task-top">
          <button
            type="button"
            class="rail-task-title"
            :aria-expanded="task.kind === 'bash' ? isOpen(task.id) : undefined"
            :disabled="task.kind === 'agent' && !task.sessionId"
            @click="activate(task)"
          >
            <span class="rail-dot" :data-status="task.status" aria-hidden="true" />

            <span class="rail-task-name" :class="{ shimmer: task.status === 'running' }">
              {{ task.description }}
            </span>
          </button>

          <IconButton
            v-if="task.kind === 'bash' && task.status === 'running'"
            class="rail-task-stop"
            type="button"
            size="s"
            variant="ghost"
            :aria-label="t('rail.stopTask')"
            :disabled="stopping.has(task.id)"
            @click="stop(task.id)"
          >
            <StopIcon aria-hidden="true" />
          </IconButton>
        </div>

        <div class="rail-task-meta">
          <span>{{ t(`rail.taskKind.${task.kind}`) }}</span>
          <span v-if="statusText(task)">{{ statusText(task) }}</span>
          <span v-if="elapsed(task)" class="rail-task-time">{{ elapsed(task) }}</span>

          <span v-if="task.kind === 'agent' && task.tokens > 0">
            {{ formatTokenCount(task.tokens) }}
          </span>
        </div>

        <div class="rail-task-step">{{ taskDetail(task) }}</div>

        <div v-if="task.kind === 'bash' && isOpen(task.id)" class="rail-task-output">
          <pre v-if="task.output" :ref="(el) => follow(task.id, el)">{{
            plainOutput(task.output)
          }}</pre>

          <span v-else>
            {{ task.status === "running" ? t("rail.noOutputYet") : t("rail.noOutput") }}
          </span>
        </div>
      </article>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, type ComponentPublicInstance } from "vue"
import { useNow } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { StopIcon, TrashBinMinimalisticIcon } from "@components/icons/index.js"
import { formatTokenCount } from "@features/composer/lib/context-usage.js"
import { taskDetail } from "@features/transcript-view/index.js"
import {
  dismissTasks,
  plainOutput,
  readDismissed,
  taskSections,
} from "@features/session-rail/lib/task-list.js"
import { formatElapsed } from "@utils/time.js"
import type { Task } from "@/types/common-type.js"

const props = defineProps<{ tasks: readonly Task[]; sessionId: string | undefined }>()
const emit = defineEmits<{
  open: [child: { sessionId: string; agent: string }]
  stop: [taskId: string]
}>()
const { t } = useI18n()
const now = useNow({ interval: 1000 })
const openIds = ref(new Set<string>())
const stopping = ref(new Set<string>())
const dismissed = ref<string[]>([])

watch(
  () => props.sessionId,
  (id) => {
    dismissed.value = id ? readDismissed(id) : []
  },
  { immediate: true },
)

const sections = computed(() => {
  const hidden = new Set(dismissed.value)
  // 清除过的任务又跑起来时照常显示
  const visible = props.tasks.filter((task) => task.status === "running" || !hidden.has(task.id))
  const { running, finished } = taskSections(visible)
  return [
    { id: "running", title: t("rail.tasksRunning"), tasks: running },
    { id: "finished", title: t("rail.tasksFinished"), tasks: finished },
  ]
})
const isOpen = (id: string) => openIds.value.has(id)

/** 命令任务展开看输出；代理任务打开子会话。 */
function activate(task: Task) {
  if (task.kind === "agent") {
    if (task.sessionId) emit("open", { sessionId: task.sessionId, agent: task.description })
    return
  }

  const next = new Set(openIds.value)

  if (!next.delete(task.id)) next.add(task.id)
  openIds.value = next
}

function stop(id: string) {
  stopping.value = new Set(stopping.value).add(id)
  emit("stop", id)
}

function clearFinished() {
  const ids = sections.value[1]!.tasks.map((task) => task.id)

  if (props.sessionId && ids.length) dismissed.value = dismissTasks(props.sessionId, ids)
}

/** 新输出到来时跟到底部。 */
function follow(_id: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) void nextTick(() => (el.scrollTop = el.scrollHeight))
}

function statusText(task: Task): string {
  if (task.status === "queued") return t("rail.queued")

  if (task.status === "failed") return t("rail.failed")

  if (task.status === "stopped") return t("rail.aborted")
  return ""
}

function elapsed(task: Task): string {
  if (task.startedAt === undefined) return ""
  const end = task.status === "running" ? now.value.getTime() : task.completedAt
  return end === undefined ? "" : formatElapsed(end - task.startedAt, { showMs: false })
}
</script>

<style scoped>
.rail-tasks {
  display: grid;
}

.rail-tasks-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-block-size: var(--space-xl);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
}

.rail-task {
  display: grid;
  gap: var(--space-xxs);
  padding: var(--space-xs) 0;
  border-block-start: 1px solid var(--border-soft);
}

.rail-task-top {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.rail-task-title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
  padding: 0;
  color: inherit;
  text-align: start;
  background: none;
  border: 0;
  cursor: pointer;
}

.rail-task-title:disabled {
  cursor: default;
}

.rail-task-title:not(:disabled):hover .rail-task-name {
  color: var(--link);
}

.rail-dot {
  flex: none;
  inline-size: var(--space-xs);
  block-size: var(--space-xs);
  background: var(--contrast-foreground-faint);
  border-radius: var(--radius-pill);
}

.rail-dot[data-status="running"] {
  background: var(--primary);
}

.rail-dot[data-status="completed"] {
  background: var(--success);
}

.rail-dot[data-status="failed"] {
  background: var(--danger);
}

.rail-task-name {
  min-inline-size: 0;
  overflow: hidden;
  font-size: var(--text-body);
  color: var(--contrast-foreground);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-task-meta,
.rail-task-step,
.rail-task-output {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
}

.rail-task-meta {
  display: flex;
  gap: var(--space-xs);
}

.rail-task-time {
  font-variant-numeric: tabular-nums;
}

.rail-task-step {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-task-output pre {
  max-block-size: var(--size-task-output-max);
  margin: 0;
  padding: var(--space-xs);
  overflow: auto;
  color: var(--contrast-foreground-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--fill-quiet);
  border-radius: var(--radius-control);
}
</style>
