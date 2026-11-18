<template>
  <Card as="aside" class="rail-pane" :aria-label="title">
    <header class="rail-pane-head">
      <h2 class="rail-pane-title">
        <span class="rail-pane-name">{{ title }}</span>
        <span v-if="pane.kind === 'child'" class="rail-pane-meta">{{ t("rail.readOnly") }}</span>
      </h2>

      <Tooltip v-for="action in actions" :key="action.key">
        <TooltipTrigger as-child>
          <IconButton
            type="button"
            size="s"
            variant="ghost"
            color="gray"
            :aria-label="action.label"
            :disabled="action.disabled"
            @click="action.run"
          >
            <component :is="action.icon" class="size-icon" />
          </IconButton>
        </TooltipTrigger>

        <TooltipContent>{{ action.label }}</TooltipContent>
      </Tooltip>
    </header>

    <div class="rail-pane-body" :data-kind="pane.kind">
      <RailTasks
        v-if="pane.kind === 'tasks'"
        :sections="sections"
        :stoppable="stoppable"
        :focus="pane.focus"
        @open="rail.openChild"
        @stop="emit('stop', $event)"
      />

      <RailChild v-else-if="pane.kind === 'child'" :child="pane.child" :progress="progress" />

      <RailContextPreview
        v-else-if="sessionId"
        :session-id="sessionId"
        :segment="pane.segment"
        @title="(next) => (contextTitle = next)"
      />
    </div>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@components/ui/button/index.js"
import { Card } from "@components/ui/card/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { XIcon, TrashIcon } from "@components/icons/index.js"
import RailChild from "@features/session-rail/components/RailChild.vue"
import RailContextPreview from "@features/session-rail/components/RailContextPreview.vue"
import RailTasks from "@features/session-rail/components/RailTasks.vue"
import { useSessionRail, type RailPane } from "@features/session-rail/index.js"
import type { TaskSections } from "@features/session-rail/lib/task-list.js"

const props = defineProps<{
  pane: RailPane
  sections: TaskSections
  stoppable: ReadonlySet<string>
  sessionId: string | undefined
  /** 面板里那个子任务的进展指纹。 */
  progress: string
}>()
const emit = defineEmits<{ stop: [taskId: string] }>()
const { t } = useI18n()
const rail = useSessionRail()!
const contextTitle = ref("")
const title = computed(() => {
  if (props.pane.kind === "tasks") return t("rail.tasks")

  if (props.pane.kind === "child") return props.pane.child.agent
  return contextTitle.value || props.pane.segment.label
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

watch(
  () => props.pane,
  () => (contextTitle.value = ""),
)

function clearFinished() {
  if (props.sessionId)
    rail.dismiss(
      props.sessionId,
      props.sections.finished.map((task) => task.id),
    )
}
</script>

<style scoped>
/* 会话面板的第三列：头部之下、贴右边，宽度两档；正文自己滚，头部不动 */
/* 面板列里的一张 Card：宽高都随所在的挂载点，去掉卡片内边距，不铺底 */
.rail-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  padding: 0;
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-pane-meta {
  flex-shrink: 0;
  color: var(--fg-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-normal);
}

.rail-pane-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-block-size: 0;
  padding: 0 var(--space-md) var(--space-md);
  overflow-y: auto;
}

/* 子会话的时间线自带滚动与边距 */
.rail-pane-body[data-kind="child"] {
  padding: 0;
  overflow: hidden;
}
</style>
