<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <Card as="section" size="s" class="rail-summary-card" :aria-label="t('rail.title')">
        <Collapsible v-for="id in shown" :key="id" as-child :open="isOpen(id)">
          <section class="rail-part" :data-id="id" :aria-labelledby="`${uid}-${id}`">
            <h3 :id="`${uid}-${id}`" class="rail-heading">
              <button
                type="button"
                class="rail-head"
                :aria-expanded="isOpen(id)"
                :aria-controls="`${uid}-${id}-body`"
                @click="
                  $event.altKey
                    ? rail.setAllOpen(rail.layout.value.closed.length > 0)
                    : rail.toggleOpen(id)
                "
              >
                <span class="rail-title">{{ titles[id] }}</span>

                <ChevronRightIcon
                  class="rail-caret motion-turn"
                  :class="{ 'is-on': isOpen(id) }"
                  aria-hidden="true"
                />

                <span class="rail-summary" :aria-hidden="isOpen(id) || undefined">
                  <template v-if="id === 'environment'">{{ place.host }}</template>

                  <template v-else-if="id === 'context' && usage">
                    {{ usage.percent }}%
                    <span class="rail-battery" :data-severity="severity" aria-hidden="true">
                      <i :style="{ inlineSize: `${Math.min(100, usage.percent)}%` }" />
                    </span>
                  </template>

                  <template v-else-if="id === 'tasks' && sections.running.length">
                    {{ t("rail.runningCount", { count: sections.running.length }) }}
                  </template>
                </span>
              </button>
            </h3>

            <CollapsibleContent :id="`${uid}-${id}-body`">
              <div class="rail-body">
                <template v-if="id === 'environment'">
                  <div class="rail-kv">
                    <span>{{ t("rail.location") }}</span>
                    <span class="rail-value">{{ place.host }}</span>
                  </div>

                  <div v-if="place.path" class="rail-kv">
                    <span>{{ t("rail.cwd") }}</span>
                    <span class="rail-value" :title="place.path">{{ place.path }}</span>
                  </div>

                  <div v-if="model" class="rail-kv">
                    <span>{{ t("rail.model") }}</span>

                    <span class="rail-value rail-model">
                      <VendorMark :vendor="model.provider" :size="14" />
                      <span class="rail-model-id">{{ model.id }}</span>
                    </span>
                  </div>
                </template>

                <RailContext
                  v-else-if="id === 'context' && usage"
                  :usage="usage"
                  :session-id="sessionId"
                />

                <template v-else-if="id === 'tasks'">
                  <RailTaskRows
                    :sections="sections"
                    :stoppable="stoppable"
                    :stopping="stopping"
                    @open="(focus) => rail.openPane({ kind: 'tasks', focus })"
                    @stop="emit('stop', $event)"
                  />

                  <div v-for="line in statusLines" :key="line" class="rail-status">{{ line }}</div>
                </template>
              </div>
            </CollapsibleContent>
          </section>
        </Collapsible>
      </Card>
    </ContextMenuTrigger>

    <ContextMenuContent size="s">
      <ContextMenuLabel>{{ t("rail.show") }}</ContextMenuLabel>

      <ContextMenuCheckboxItem
        v-for="item in RAIL_SECTIONS"
        :key="item"
        :model-value="!rail.layout.value.hidden.includes(item)"
        :disabled="shown.length === 1 && shown[0] === item"
        close-on-select
        @update:model-value="rail.toggleHidden(item)"
      >
        {{ titles[item] }}
      </ContextMenuCheckboxItem>

      <ContextMenuSeparator />
      <ContextMenuItem @select="rail.setAllOpen(true)">{{ t("rail.expandAll") }}</ContextMenuItem>

      <ContextMenuItem @select="rail.setAllOpen(false)">
        {{ t("rail.collapseAll") }}
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
</template>

<script setup lang="ts">
import { computed, useId } from "vue"
import { useI18n } from "@i18n/index.js"
import { ChevronRightIcon } from "@components/icons/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import { Card } from "@components/ui/card/index.js"
import { Collapsible, CollapsibleContent } from "@components/ui/collapsible/index.js"
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import type { ContextUsage } from "@features/composer/type.js"
import { contextSeverity } from "@features/composer/lib/context-usage.js"
import RailContext from "@features/session-rail/components/RailContext.vue"
import RailTaskRows from "@features/session-rail/components/RailTaskRows.vue"
import { useSessionRail } from "@features/session-rail/index.js"
import { RAIL_SECTIONS, type RailSectionId } from "@features/session-rail/lib/sections.js"
import type { TaskSections } from "@features/session-rail/lib/task-list.js"

const REMOTE_KEY = /^ssh:[/][/]([^/]+)([/].*)?$/
const props = defineProps<{
  cwd: string | undefined
  localHost: string | undefined
  model: { provider: string; id: string } | undefined
  usage: ContextUsage | undefined
  sessionId: string | undefined
  sections: TaskSections
  stoppable: ReadonlySet<string>
  stopping: ReadonlySet<string>
  statuses: ReadonlyMap<string, string> | undefined
}>()
const emit = defineEmits<{ stop: [taskId: string] }>()
const { t } = useI18n()
const rail = useSessionRail()!
const uid = useId()
const titles = computed<Record<RailSectionId, string>>(() => ({
  environment: t("rail.environment"),
  context: t("rail.context"),
  tasks: t("rail.tasks"),
}))
const severity = computed(() => contextSeverity(props.usage?.percent ?? 0))
const place = computed(() => {
  const remote = props.cwd ? REMOTE_KEY.exec(props.cwd) : null
  return remote
    ? { host: remote[1], path: remote[2] || "/" }
    : { host: props.localHost ?? t("rail.local"), path: props.cwd }
})
const statusLines = computed(() => [...(props.statuses?.values() ?? [])].filter(Boolean))
const shown = computed(() =>
  RAIL_SECTIONS.filter((id) => {
    if (rail.layout.value.hidden.includes(id)) return false

    if (id === "context") return Boolean(props.usage)

    if (id === "tasks")
      return (
        props.sections.running.length + props.sections.finished.length > 0 ||
        statusLines.value.length > 0
      )
    return true
  }),
)
const isOpen = (id: RailSectionId) => !rail.layout.value.closed.includes(id)
</script>

<style scoped>
.rail-summary-card[data-slot="card"] {
  --card-surface: var(--bg-surface);
  --card-padding: 0;
}

.rail-part {
  padding: var(--space-2xs) var(--space-sm);
}

.rail-part + .rail-part {
  box-shadow: var(--separator-top);
}

.rail-heading {
  display: flex;
  margin: 0;
}

.rail-head {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2xs);
  min-inline-size: 0;
  min-block-size: var(--control-sm);
  padding: 0;
  color: var(--fg-secondary);
  font: inherit;
  font-size: var(--text-meta);
  font-weight: 500;
  text-align: start;
  background: none;
  border: 0;
  border-radius: var(--radius-control);
  cursor: pointer;
}

.rail-head:hover {
  color: var(--fg);
}

.rail-head:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.rail-title {
  flex-shrink: 0;
}

.rail-caret {
  flex-shrink: 0;
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

.rail-summary {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-2xs);
  min-inline-size: 0;
  margin-inline-start: var(--space-xs);
  overflow: hidden;
  color: var(--fg-secondary);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.rail-summary[aria-hidden="true"] {
  opacity: 0;
}

.rail-body {
  padding-block-end: var(--space-xs);
}

.rail-kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  min-block-size: var(--control-sm);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  white-space: nowrap;
}

.rail-value {
  min-inline-size: 0;
  overflow: hidden;
  color: var(--fg);
  font-family: var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-model {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
}

.rail-model > :first-child {
  flex-shrink: 0;
}

.rail-model-id {
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rail-battery {
  display: flex;
  flex-shrink: 0;
  inline-size: var(--space-lg);
  block-size: 10px;
  padding: 2px;
  background: var(--bg-emphasis);
  border-radius: var(--radius-pill);
}

.rail-battery i {
  min-inline-size: 6px;
  background: var(--info-solid);
  border-radius: var(--radius-pill);
}

.rail-battery[data-severity="warning"] i {
  background: var(--warning-text);
}

.rail-battery[data-severity="critical"] i {
  background: var(--danger-text);
}

.rail-status {
  font-family: var(--font-mono);
  font-size: var(--text-meta);
  color: var(--fg-secondary);
}
</style>
