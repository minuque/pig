<template>
  <aside class="rail-pane" :aria-label="title">
    <header class="rail-pane-head">
      <h2 class="rail-pane-title">
        <OverflowTooltip class="rail-pane-name" :text="title" />

        <span v-if="pane.kind === 'child'" class="rail-pane-meta">
          {{ t("rail.readOnly") }}
        </span>
      </h2>

      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              type="button"
              size="s"
              variant="ghost"
              color="neutral"
              :aria-label="action.label"
              :disabled="action.disabled"
              @click="action.run"
            >
              <component :is="action.icon" class="size-icon" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>
    </header>

    <div v-if="pane.kind === 'tasks'" class="rail-pane-scroll">
      <div class="rail-pane-body" data-kind="tasks">
        <RailTasks
          :sections="sections"
          :stoppable="stoppable"
          :stopping="stopping"
          :stop-errors="stopErrors"
          :focus="pane.focus"
          @open="rail.openChild"
          @stop="emit('stop', $event)"
        />
      </div>
    </div>

    <div v-else class="rail-pane-body" data-kind="child">
      <RailChild :child="pane.child" :progress="progress" />
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { OverflowTooltip, Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { XIcon, TrashIcon } from "@components/icons/index.js"
import RailChild from "@features/session-rail/components/RailChild.vue"
import RailTasks from "@features/session-rail/components/RailTasks.vue"
import { useSessionRail, type RailPane } from "@features/session-rail/index.js"
import type { TaskSections } from "@features/session-rail/lib/task-list.js"

const props = defineProps<{
  pane: RailPane
  sections: TaskSections
  stoppable: ReadonlySet<string>
  stopping: ReadonlySet<string>
  stopErrors?: ReadonlyMap<string, string> | undefined
  sessionId: string | undefined
  progress: string
}>()
const emit = defineEmits<{ stop: [taskId: string] }>()
const { t } = useI18n()
const rail = useSessionRail()!
const title = computed(() => {
  if (props.pane.kind === "tasks") return t("rail.tasks")
  return props.pane.child.agent
})
const actions = computed(() => [
  ...(props.pane.kind === "tasks"
    ? [
        {
          key: "clear",
          label: t("rail.clearFinished"),
          icon: TrashIcon,
          disabled: props.sections.finished.length === 0,
          run: clearFinished,
        },
      ]
    : []),
  { key: "close", label: t("common.close"), icon: XIcon, disabled: false, run: rail.closePane },
])

function clearFinished() {
  if (props.sessionId)
    rail.dismiss(
      props.sessionId,
      props.sections.finished.map((task) => task.id),
    )
}
</script>

<style scoped>
.rail-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
}

.rail-pane-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-sm) var(--space-sm) var(--space-md);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.rail-pane-title {
  display: flex;
  flex: 1;
  align-items: baseline;
  gap: var(--space-xs);
  min-inline-size: 0;
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body--line-height);
}

.rail-pane-name {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-pane-meta {
  flex-shrink: 0;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
  white-space: nowrap;
}

.rail-pane-scroll {
  flex: 1;
  min-block-size: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.rail-pane-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  padding: var(--space-sm) var(--space-sm) var(--space-md);
}

.rail-pane-body[data-kind="child"] {
  padding: 0;
  overflow: hidden;
}
</style>
