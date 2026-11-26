<template>
  <Drawer v-if="session.sessionId.value" v-model:open="rail.open.value" side="right" :modal="false">
    <Tooltip>
      <DrawerTrigger v-bind="focused ? { shortcut: 'mod+j' } : {}">
        <template #render="{ props: part }">
          <TooltipTrigger v-bind="part">
            <template #render="{ props: part }">
              <IconButton
                v-bind="part"
                class="rail-toggle"
                type="button"
                size="m"
                color="neutral"
                variant="ghost"
                :data-active="rail.open.value || undefined"
                :aria-label="t('rail.toggle')"
              >
                <NotepadTextIcon class="size-icon-lg" />
              </IconButton>
            </template>
          </TooltipTrigger>
        </template>
      </DrawerTrigger>

      <TooltipContent>{{ label }}</TooltipContent>
    </Tooltip>

    <DrawerContent class="rail-drawer" :aria-label="t('rail.title')">
      <header class="rail-drawer-head">
        <DrawerTitle class="rail-drawer-title">{{ t("rail.title") }}</DrawerTitle>

        <DrawerClose>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              size="s"
              variant="ghost"
              color="neutral"
              :aria-label="t('common.close')"
            >
              <XIcon class="size-icon" />
            </IconButton>
          </template>
        </DrawerClose>
      </header>

      <div class="rail-drawer-body">
        <RailSummary v-bind="cards" @stop="stopTask" />
      </div>

      <Drawer :open="Boolean(rail.pane.value)" side="right" :modal="false" @open-change="onPane">
        <DrawerContent v-if="rail.pane.value" class="rail-drawer is-pane">
          <RailPane
            :pane="rail.pane.value"
            :sections="sections"
            :stoppable="cards.stoppable"
            :stopping="cards.stopping"
            :session-id="session.sessionId.value"
            :progress="childProgress"
            @stop="stopTask"
          />
        </DrawerContent>
      </Drawer>
    </DrawerContent>
  </Drawer>
</template>

<script setup lang="ts">
import { computed, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { NotepadTextIcon, XIcon } from "@components/icons/index.js"
import { IconButton } from "@pig/ui/button"
import { Drawer, DrawerClose, DrawerContent, DrawerTitle, DrawerTrigger } from "@pig/ui/drawer"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import RailPane from "@features/session-rail/components/RailPane.vue"
import RailSummary from "@features/session-rail/components/RailSummary.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"

defineProps<{ focused: boolean }>()

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

watch(session.sessionId, rail.enterSession, { immediate: true })

function onPane(open: boolean) {
  if (!open) rail.closePane()
}

const label = computed(() => {
  const usage = session.contextUsage.value
  const parts = [t("rail.title"), ...(usage ? [`${usage.percent}%`] : [])]

  if (tasks.value.length)
    parts.push(
      t("rail.taskCount", {
        done: tasks.value.filter((task) => task.status === "completed").length,
        total: tasks.value.length,
      }),
    )
  return parts.join(" · ")
})
</script>

<style scoped>
.rail-toggle[data-active] {
  color: var(--fg);
  background: var(--bg-selected);
}

.rail-drawer-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-sm) var(--space-xs) var(--space-md);
}

.rail-drawer-title {
  flex: 1;
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body--line-height);
}

.rail-drawer-body {
  flex: 1;
  min-block-size: 0;
  padding: 0 var(--space-xs) var(--space-xs);
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>

<style>
.rail-drawer[data-slot="drawer-content"] {
  inline-size: min(var(--rail-width), 100%);
  scale: calc(1 - var(--drawer-stack, 0) * 0.04);
}

.rail-drawer.is-pane[data-slot="drawer-content"] {
  inline-size: min(var(--rail-pane-width), 100%);
}
</style>
