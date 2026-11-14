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
          <span class="rail-battery" :data-severity="severity" aria-hidden="true">
            <i :style="{ inlineSize: `${Math.min(100, usage.percent)}%` }" />
          </span>
        </template>

        <template v-else-if="id === 'tasks' && sections.running.length">
          {{ t("rail.runningCount", { count: sections.running.length }) }}
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

      <RailContext
        v-else-if="id === 'context' && usage"
        :usage="usage"
        :session-id="sessionId"
        @preview="(segment) => rail.openPane({ kind: 'context', segment })"
      />

      <template v-else-if="id === 'tasks'">
        <RailTaskRows
          :sections="sections"
          :stoppable="stoppable"
          @open="(focus) => rail.openPane({ kind: 'tasks', focus })"
          @stop="emit('stop', $event)"
        />

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
import type { ContextUsage } from "@features/composer/type.js"
import { contextSeverity } from "@features/composer/lib/context-usage.js"
import RailCard from "@features/session-rail/components/RailCard.vue"
import RailContext from "@features/session-rail/components/RailContext.vue"
import RailTaskRows from "@features/session-rail/components/RailTaskRows.vue"
import { useSessionRail } from "@features/session-rail/index.js"
import { RAIL_SECTIONS, type RailSectionId } from "@features/session-rail/lib/sections.js"
import type { TaskSections } from "@features/session-rail/lib/task-list.js"
import type { Task } from "@/types/common-type.js"

const REMOTE_KEY = /^ssh:[/][/]([^/]+)([/].*)?$/
const props = defineProps<{
  cwd: string | undefined
  model: string | undefined
  usage: ContextUsage | undefined
  sessionId: string | undefined
  tasks: readonly Task[]
  sections: TaskSections
  stoppable: ReadonlySet<string>
  statuses: ReadonlyMap<string, string> | undefined
}>()
const emit = defineEmits<{ stop: [taskId: string] }>()
const { t } = useI18n()
const rail = useSessionRail()!
const titles = computed<Record<RailSectionId, string>>(() => ({
  environment: t("rail.environment"),
  context: t("rail.context"),
  tasks: t("rail.tasks"),
}))
const severity = computed(() => contextSeverity(props.usage?.percent ?? 0))
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

/* 收起时摘要里的电池：圆角槽里一段电量，随用量分档变色 */
.rail-battery {
  display: flex;
  flex-shrink: 0;
  inline-size: var(--space-lg);
  block-size: var(--size-battery-block);
  padding: var(--size-battery-pad);
  background: var(--fill-strong);
  border-radius: var(--radius-pill);
}

.rail-battery i {
  min-inline-size: var(--size-battery-fill-min);
  background: var(--primary);
  border-radius: var(--radius-pill);
}

.rail-battery[data-severity="warning"] i {
  background: var(--warning);
}

.rail-battery[data-severity="critical"] i {
  background: var(--danger);
}

.rail-status {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--contrast-foreground-faint);
}
</style>
