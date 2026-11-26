<template>
  <div v-if="session.sessionId.value" class="session-rail">
    <aside v-if="rail.dockedShown.value" class="rail-docked" :aria-label="t('rail.title')">
      <RailSummary v-bind="cards" @stop="stopTask" />
    </aside>

    <Teleport v-if="rail.pane.value && paneSlot" :to="paneSlot">
      <RailPane
        :pane="rail.pane.value"
        :sections="sections"
        :stoppable="cards.stoppable"
        :stopping="cards.stopping"
        :session-id="session.sessionId.value"
        :progress="childProgress"
        @stop="stopTask"
      />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import RailSummary from "@features/session-rail/components/RailSummary.vue"
import RailPane from "@features/session-rail/components/RailPane.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"
import { usePanelHost } from "@features/panel-host/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, tasks, sections, cards, stopTask } = useRailCards()
const childProgress = computed(() => {
  const pane = rail.pane.value
  const open = pane?.kind === "child" ? pane.child : undefined
  const task = tasks.value.find(
    (item) => item.kind === "agent" && item.sessionId === open?.sessionId,
  )
  return task?.kind === "agent"
    ? `${task.status}:${task.steps.length}:${task.steps.at(-1) ?? ""}`
    : ""
})
const host = usePanelHost()
const paneSlot = computed(() => host?.slots.get("tasks"))

watch(session.sessionId, rail.enterSession, { immediate: true })

watch(
  () => Boolean(session.sessionId.value && rail.pane.value),
  (open) => (open ? host?.open("tasks") : host?.close("tasks")),
  { immediate: true },
)
</script>

<style scoped>
.session-rail {
  display: contents;
}

.rail-docked {
  inline-size: var(--rail-width);
  min-block-size: 0;
  padding: var(--space-xs) var(--border-width) var(--space-sm);
  overflow-y: auto;
  scrollbar-width: none;
}
</style>
