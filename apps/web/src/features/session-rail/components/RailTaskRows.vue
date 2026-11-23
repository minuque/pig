<template>
  <div class="task-rows">
    <div v-for="task in shownRunning" :key="task.id" class="task-row">
      <button
        type="button"
        class="task-row-open"
        :aria-label="t('rail.openTask', { name: task.description })"
        @click="emit('open', task.id)"
      >
        <component :is="task.kind === 'agent' ? SparklesIcon : SquareCodeIcon" />

        <span class="task-row-name" :class="{ shimmer: task.status === 'running' }">
          {{ task.description }}
        </span>

        <span class="task-row-time">{{ taskElapsed(task, now.getTime()) }}</span>
      </button>

      <IconButton
        v-if="stoppable.has(task.id)"
        type="button"
        size="s"
        variant="ghost"
        color="neutral"
        :aria-label="t('rail.stopTask')"
        :disabled="stopping.has(task.id)"
        @click="emit('stop', task.id)"
      >
        <SquareIcon class="size-icon" />
      </IconButton>
    </div>

    <button
      v-if="moreCount > 0"
      type="button"
      class="task-row-open"
      @click="emit('open', undefined)"
    >
      <SparklesIcon />
      <span class="task-row-name">{{ t("rail.moreTasks", { count: moreCount }) }}</span>
    </button>

    <button
      v-if="sections.finished.length"
      type="button"
      class="task-row-open"
      @click="emit('open', undefined)"
    >
      <CircleCheckIcon />

      <span class="task-row-name">
        {{ t("rail.finishedCount", { count: sections.finished.length }) }}
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useNow } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import {
  CircleCheckIcon,
  SquareCodeIcon,
  SparklesIcon,
  SquareIcon,
} from "@components/icons/index.js"
import { taskElapsed, type TaskSections } from "@features/session-rail/lib/task-list.js"

const LIMIT = 4
const props = defineProps<{
  sections: TaskSections
  stoppable: ReadonlySet<string>
  stopping: ReadonlySet<string>
}>()
const emit = defineEmits<{ open: [taskId: string | undefined]; stop: [taskId: string] }>()
const { t } = useI18n()
const now = useNow({ interval: 1000 })
const shownRunning = computed(() => props.sections.running.slice(0, LIMIT))
const moreCount = computed(() => props.sections.running.length - shownRunning.value.length)
</script>

<style scoped>
.task-rows {
  display: flex;
  flex-direction: column;
}

.task-row {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
}

.task-row-open {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-inline-size: 0;
  min-block-size: var(--control-sm);
  padding-inline: var(--space-2xs);
  color: var(--fg);
  font: inherit;
  font-size: var(--text-meta);
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.task-row-open:hover {
  background: var(--bg-hover);
}

.task-row-open:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.task-row-open > svg {
  flex-shrink: 0;
  inline-size: var(--icon-md);
  block-size: var(--icon-md);
  color: var(--fg-secondary);
}

.task-row-name {
  flex: 1;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-row-time {
  flex-shrink: 0;
  color: var(--fg-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
