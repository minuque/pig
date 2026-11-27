<template>
  <div ref="root" class="rail-tasks">
    <section v-for="section in shown" :key="section.id" class="rail-tasks-section">
      <h3 class="rail-tasks-head">
        {{ section.title }}
        <span class="rail-tasks-count">{{ section.tasks.length }}</span>
      </h3>

      <Collapsible
        v-for="task in section.tasks"
        :key="task.id"
        :open="task.kind === 'bash' && isOpen(task.id)"
        @update:open="toggle(task.id)"
      >
        <template #render="{ props: part }">
          <article
            v-bind="part"
            class="rail-task"
            :data-task-id="task.id"
            :data-status="task.status"
            :data-kind="task.kind"
          >
            <div class="rail-task-top">
              <CollapsibleTrigger v-if="task.kind === 'bash'">
                <template #render="{ props: part }">
                  <button v-bind="part" type="button" class="rail-task-title">
                    <StatusIndicator
                      class="rail-task-status"
                      :status="STATUS_TONE[task.status]"
                      size="s"
                      :pulse="task.status === 'running'"
                    />

                    <span class="rail-task-name" :class="{ shimmer: task.status === 'running' }">
                      {{ task.description }}
                    </span>

                    <ChevronRightIcon class="rail-task-chevron size-icon" />
                  </button>
                </template>
              </CollapsibleTrigger>

              <span v-else class="rail-task-title">
                <StatusIndicator
                  class="rail-task-status"
                  :status="STATUS_TONE[task.status]"
                  size="s"
                  :pulse="task.status === 'running'"
                />

                <span class="rail-task-name" :class="{ shimmer: task.status === 'running' }">
                  {{ task.description }}
                </span>
              </span>

              <Tooltip v-if="stoppable.has(task.id)">
                <TooltipTrigger>
                  <template #render="{ props: part }">
                    <IconButton
                      v-bind="part"
                      type="button"
                      size="s"
                      variant="ghost"
                      color="neutral"
                      class="task-stop"
                      :aria-label="t('rail.stopTask')"
                      :disabled="stopping.has(task.id)"
                      @click="emit('stop', task.id)"
                    >
                      <SquareIcon class="size-icon" fill="currentColor" />
                    </IconButton>
                  </template>
                </TooltipTrigger>

                <TooltipContent>{{ t("rail.stopTask") }}</TooltipContent>
              </Tooltip>
            </div>

            <div class="rail-task-meta">
              <span>{{ t(`rail.taskKind.${task.kind}`) }}</span>

              <span
                v-if="statusText(task)"
                :class="{ 'rail-task-failed': task.status === 'failed' }"
              >
                {{ statusText(task) }}
              </span>

              <span class="rail-task-value">{{ taskElapsed(task, now.getTime()) }}</span>

              <span v-if="task.kind === 'agent' && task.tokens > 0">
                <span class="rail-task-value">{{ formatTokenCount(task.tokens) }}</span>
                {{ t("rail.tokens") }}
              </span>
            </div>

            <p
              v-if="task.kind === 'agent' && task.status === 'running' && task.steps.length"
              class="rail-task-step"
            >
              {{ task.steps.at(-1) }}
            </p>

            <Button
              v-if="task.kind === 'agent' && task.sessionId"
              class="rail-task-open"
              size="s"
              variant="secondary"
              @click="emit('open', { sessionId: task.sessionId, agent: task.description })"
            >
              {{ t("rail.viewTranscript") }}
            </Button>

            <CollapsibleContent v-if="task.kind === 'bash'">
              <div class="rail-task-output">
                <code class="rail-task-command">{{ task.command }}</code>

                <pre v-if="task.output" :ref="(el) => bindOutput(task.id, el)">{{
                  plainOutput(task.output)
                }}</pre>

                <span v-else class="rail-task-empty">
                  {{ task.status === "running" ? t("rail.noOutputYet") : t("rail.noOutput") }}
                </span>
              </div>
            </CollapsibleContent>
          </article>
        </template>
      </Collapsible>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch, type ComponentPublicInstance } from "vue"
import { useNow } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { Button, IconButton } from "@pig/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import { StatusIndicator, type StatusTone } from "@pig/ui/status-indicator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { ChevronRightIcon, SquareIcon } from "@components/icons/index.js"
import { formatTokenCount } from "@features/composer/lib/context-usage.js"
import type { OpenChild } from "@features/session-rail/index.js"
import {
  plainOutput,
  taskElapsed,
  type TaskSections,
} from "@features/session-rail/lib/task-list.js"
import type { Task } from "@/types/common-type.js"

const STATUS_TONE: Record<Task["status"], StatusTone> = {
  queued: "idle",
  running: "running",
  completed: "success",
  failed: "error",
  stopped: "idle",
}
const props = defineProps<{
  sections: TaskSections
  stoppable: ReadonlySet<string>
  stopping: ReadonlySet<string>
  focus?: string | undefined
}>()
const emit = defineEmits<{ open: [child: OpenChild]; stop: [taskId: string] }>()
const { t } = useI18n()
const now = useNow({ interval: 1000 })
const openIds = ref(new Set<string>())
const root = useTemplateRef("root")
const shown = computed(() =>
  [
    { id: "running", title: t("rail.tasksRunning"), tasks: props.sections.running },
    { id: "finished", title: t("rail.tasksFinished"), tasks: props.sections.finished },
  ].filter((section) => section.tasks.length),
)
const isOpen = (id: string) => openIds.value.has(id)

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

const FOLLOW_SLACK_PX = 16
const outputs = new Map<string, HTMLElement>()
const toBottom = (el: HTMLElement) => void nextTick(() => (el.scrollTop = el.scrollHeight))

function bindOutput(id: string, el: Element | ComponentPublicInstance | null) {
  if (!(el instanceof HTMLElement)) return void outputs.delete(id)

  if (outputs.get(id) !== el) toBottom(el)
  outputs.set(id, el)
}

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
@media (hover: hover) {
  [data-button].task-stop:hover:not(:disabled) {
    color: var(--danger-text);
  }
}

.rail-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.rail-tasks-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.rail-tasks-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  margin: 0;
  padding-inline: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
}

.rail-tasks-count {
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
}

.rail-task {
  display: flex;
  flex-direction: column;
  gap: var(--space-2xs);
  padding: var(--space-2xs) var(--space-2xs) var(--space-xs);
  overflow-wrap: anywhere;
  border-radius: var(--radius-card);
  corner-shape: round;
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
}

.rail-task[data-status="running"] {
  background: var(--bg-surface);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

.rail-task-top {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
}

.rail-task-title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
  padding: var(--space-2xs) var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: none;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  text-align: start;
}

.rail-task[data-status="running"] .rail-task-title {
  color: var(--fg);
  font-weight: var(--font-weight-medium);
}

button.rail-task-title {
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-out);
}

button.rail-task-title:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

button.rail-task-title:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.rail-task-status {
  flex-shrink: 0;
}

.rail-task-name {
  flex: 1;
  min-inline-size: 0;
}

.rail-task-chevron {
  flex-shrink: 0;
  color: var(--fg-muted);
  transition: rotate var(--duration-fast) var(--ease-out);
}

.rail-task[data-open] .rail-task-chevron {
  rotate: 90deg;
}

.rail-task-meta,
.rail-task-step,
.rail-task-output {
  margin-inline: var(--space-xs);
}

.rail-task-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-2xs) var(--space-sm);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.rail-task-value {
  font-variant-numeric: tabular-nums;
}

.rail-task-failed {
  color: var(--danger-text);
}

.rail-task-step {
  margin-block: 0;
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-task-open {
  align-self: flex-start;
  margin: var(--space-2xs) var(--space-xs) 0;
}

.rail-task-output {
  display: grid;
  gap: var(--space-xs);
  margin-block-start: var(--space-2xs);
  color: var(--fg-secondary);
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-autospace: no-autospace;
  text-spacing-trim: space-all;
}

.rail-task-command {
  max-block-size: 200px;
  overflow: auto;
  color: var(--fg);
  font: inherit;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.rail-task-command::before {
  content: "$ ";
  color: var(--fg-muted);
}

.rail-task-output pre {
  max-block-size: 240px;
  margin: 0;
  padding: var(--space-xs) var(--space-sm);
  overflow: auto;
  color: var(--fg-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--bg-muted);
  border-radius: var(--radius-control);
}

.rail-task-empty {
  color: var(--fg-muted);
}

@media (prefers-reduced-motion: reduce) {
  button.rail-task-title,
  .rail-task-chevron {
    transition: none;
  }
}
</style>
