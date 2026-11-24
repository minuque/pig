<template>
  <div v-if="session.sessionId.value" class="rail-toggle">
    <Tooltip v-if="rail.mode.value === 'docked'">
      <TooltipTrigger as-child>
        <IconButton
          class="rail-toggle-docked"
          type="button"
          size="m"
          color="neutral"
          variant="ghost"
          :data-active="rail.docked.value || undefined"
          :aria-pressed="rail.docked.value"
          :aria-label="t('rail.toggle')"
          @click="rail.toggleDocked"
        >
          <NotepadTextIcon class="size-icon-lg" />

          <StatusIndicator
            v-if="runningCount > 0"
            class="rail-toggle-dot"
            status="running"
            size="m"
          />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ label }}</TooltipContent>
    </Tooltip>

    <Popover v-else v-model:open="popoverOpen">
      <Tooltip>
        <PopoverTrigger as-child>
          <TooltipTrigger as-child>
            <IconButton
              class="rail-toggle-popover"
              type="button"
              size="m"
              color="neutral"
              variant="ghost"
              :data-active="popoverOpen || undefined"
              :aria-label="t('rail.toggle')"
            >
              <NotepadTextIcon class="size-icon-lg" />

              <StatusIndicator
                v-if="runningCount > 0"
                class="rail-toggle-dot"
                status="running"
                size="m"
              />
            </IconButton>
          </TooltipTrigger>
        </PopoverTrigger>

        <TooltipContent>{{ label }}</TooltipContent>
      </Tooltip>

      <PopoverContent class="rail-popover" align="end">
        <RailSummary v-bind="cards" @stop="stopTask" />
      </PopoverContent>
    </Popover>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { NotepadTextIcon } from "@components/icons/index.js"
import { IconButton } from "@pig/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@pig/ui/popover"
import { StatusIndicator } from "@pig/ui/status-indicator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import RailSummary from "@features/session-rail/components/RailSummary.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, tasks, runningCount, cards, stopTask } = useRailCards()
const popoverOpen = ref(false)

watch(rail.pane, (pane) => {
  if (pane) popoverOpen.value = false
})

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
.rail-toggle {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.rail-toggle :is(.rail-toggle-docked, .rail-toggle-popover) {
  position: relative;
}

.rail-toggle [data-active] {
  color: var(--fg);
  background: var(--bg-selected);
}

.rail-toggle-dot {
  position: absolute;
  inset-block-start: var(--space-2xs);
  inset-inline-end: var(--space-2xs);
}
</style>

<style>
.rail-popover[data-slot="popover-content"] {
  inline-size: var(--rail-width);
  padding: var(--space-xs);
}
</style>
