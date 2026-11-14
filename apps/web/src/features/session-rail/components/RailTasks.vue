<template>
  <div ref="root" class="rail-tasks">
    <section v-for="section in shown" :key="section.id" class="rail-tasks-section">
      <h3 class="rail-tasks-head">{{ section.title }}</h3>

      <article
        v-for="task in section.tasks"
        :key="task.id"
        class="rail-task"
        :data-task-id="task.id"
        :data-status="task.status"
        :data-kind="task.kind"
      >
        <div class="rail-task-top">
          <component
            :is="task.kind === 'bash' ? 'button' : 'span'"
            :type="task.kind === 'bash' ? 'button' : undefined"
            class="rail-task-title"
            :aria-expanded="task.kind === 'bash' ? isOpen(task.id) : undefined"
            @click="task.kind === 'bash' && toggle(task.id)"
          >
            <span class="rail-task-name" :class="{ shimmer: task.status === 'running' }">
              {{ task.description }}
            </span>
          </component>

          <Tooltip v-if="stoppable.has(task.id)">
            <TooltipTrigger as-child>
              <IconButton
                type="button"
                size="s"
                variant="soft"
                color="gray"
                :aria-label="t('rail.stopTask')"
                :disabled="stopping.has(task.id)"
                @click="stop(task.id)"
              >
                <StopIcon class="size-icon" />
              </IconButton>
            </TooltipTrigger>

            <TooltipContent>{{ t("rail.stopTask") }}</TooltipContent>
          </Tooltip>
        </div>

        <div class="rail-task-meta">
          <span class="rail-task-value">{{ t(`rail.taskKind.${task.kind}`) }}</span>

          <span v-if="statusText(task)" :class="{ 'rail-task-failed': task.status === 'failed' }">
            {{ statusText(task) }}
          </span>

          <span class="rail-task-time">{{ taskElapsed(task, now.getTime()) }}</span>
        </div>

        <div v-if="task.kind === 'agent'" class="rail-task-meta">
          <span v-if="task.tokens > 0">
            <span class="rail-task-value">{{ formatTokenCount(task.tokens) }}</span>
            {{ t("rail.tokens") }}
          </span>

          <span v-if="task.status === 'running' && task.steps.length" class="rail-task-step">
            {{ task.steps.at(-1) }}
          </span>

          <button
            v-if="task.sessionId"
            type="button"
            class="rail-task-link"
            @click="emit('open', { sessionId: task.sessionId, agent: task.description })"
          >
            {{ t("rail.viewTranscript") }}
          </button>
        </div>

        <div v-if="task.kind === 'bash' && isOpen(task.id)" class="rail-task-output">
          <div class="rail-task-command">{{ task.command }}</div>

          <pre v-if="task.output" :ref="(el) => bindOutput(task.id, el)">{{
            plainOutput(task.output)
          }}</pre>

          <span v-else>
            {{ task.status === "running" ? t("rail.noOutputYet") : t("rail.noOutput") }}
          </span>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch, type ComponentPublicInstance } from "vue"
import { useNow } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { StopIcon } from "@components/icons/index.js"
import { formatTokenCount } from "@features/composer/lib/context-usage.js"
import type { OpenChild } from "@features/session-rail/index.js"
import {
  plainOutput,
  taskElapsed,
  type TaskSections,
} from "@features/session-rail/lib/task-list.js"
import type { Task } from "@/types/common-type.js"

const props = defineProps<{
  sections: TaskSections
  stoppable: ReadonlySet<string>
  /** 从摘要卡点进来的那条任务：滚到它，命令任务顺带展开输出。 */
  focus?: string | undefined
}>()
const emit = defineEmits<{ open: [child: OpenChild]; stop: [taskId: string] }>()
const { t } = useI18n()
const now = useNow({ interval: 1000 })
const openIds = ref(new Set<string>())
const stopping = ref(new Set<string>())
const root = useTemplateRef("root")
const shown = computed(() =>
  [
    { id: "running", title: t("rail.tasksRunning"), tasks: props.sections.running },
    { id: "finished", title: t("rail.tasksFinished"), tasks: props.sections.finished },
  ].filter((section) => section.tasks.length),
)
const isOpen = (id: string) => openIds.value.has(id)

/** 命令任务展开看输出。 */
function toggle(id: string) {
  const next = new Set(openIds.value)

  if (!next.delete(id)) next.add(id)
  openIds.value = next
}

watch(
  () => props.focus,
  async (id) => {
    if (!id) return
    const task = [...props.sections.running, ...props.sections.finished].find((t) => t.id === id)

    if (task?.kind === "bash") openIds.value = new Set(openIds.value).add(id)
    await nextTick()
    root.value
      ?.querySelector(`[data-task-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({ block: "start" })
  },
  { immediate: true },
)

function stop(id: string) {
  stopping.value = new Set(stopping.value).add(id)
  emit("stop", id)
}

/** 离底部这么近算「在看最新」，新输出到来时跟到底部。 */
const FOLLOW_SLACK_PX = 16
const outputs = new Map<string, HTMLElement>()
const toBottom = (el: HTMLElement) => void nextTick(() => (el.scrollTop = el.scrollHeight))

/** 每次渲染都会调；只在第一次挂上时跳到底部。 */
function bindOutput(id: string, el: Element | ComponentPublicInstance | null) {
  if (!(el instanceof HTMLElement)) return void outputs.delete(id)

  if (outputs.get(id) !== el) toBottom(el)
  outputs.set(id, el)
}

// 渲染前量位置：用户已经往上翻的输出不跟
watch(
  () =>
    [...props.sections.running, ...props.sections.finished].map((task) =>
      task.kind === "bash" ? task.output : "",
    ),
  () => {
    for (const el of outputs.values())
      if (el.scrollHeight - el.scrollTop - el.clientHeight <= FOLLOW_SLACK_PX) toBottom(el)
  },
  { flush: "pre" },
)

function statusText(task: Task): string {
  if (task.status === "queued") return t("rail.queued")

  if (task.status === "failed") return t("rail.failed")

  if (task.status === "stopped") return t("rail.stopped")
  return ""
}
</script>

<style scoped>
/* 分段：段名在上，卡片在下；卡片铺浅底，正文三行：标题、类别与用时、细节 */
.rail-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.rail-tasks-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.rail-tasks-head {
  margin: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
  line-height: var(--text-meta--line-height);
}

.rail-task {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding: var(--space-sm);
  overflow-wrap: anywhere;
  background: var(--fill-quiet);
  border-radius: var(--radius-card);
}

.rail-task-top {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xs);
}

.rail-task-title {
  display: flex;
  flex: 1;
  min-inline-size: 0;
  padding: 0;
  color: var(--contrast-foreground-secondary);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-align: start;
  background: none;
  border: 0;
}

button.rail-task-title {
  cursor: pointer;
}

button.rail-task-title:hover .rail-task-name {
  color: var(--link);
}

.rail-task[data-status="running"] .rail-task-title {
  color: var(--contrast-foreground);
}

.rail-task-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-xxs) var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.rail-task[data-status="running"] .rail-task-value {
  color: var(--contrast-foreground-secondary);
}

.rail-task-failed {
  color: var(--danger);
}

.rail-task-time {
  font-variant-numeric: tabular-nums;
}

.rail-task-link {
  padding: 0;
  color: var(--link);
  font: inherit;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.rail-task-link:hover {
  text-decoration: underline;
  text-underline-offset: 1px;
}

.rail-task-link:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.rail-task-output {
  display: grid;
  gap: var(--space-xxs);
  color: var(--contrast-foreground-faint);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.rail-task-command {
  max-block-size: var(--size-task-output-max);
  overflow: auto;
  color: var(--contrast-foreground-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
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
