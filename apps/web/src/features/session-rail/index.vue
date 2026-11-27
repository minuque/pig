<template>
  <Transition name="fade">
    <aside
      v-if="session.sessionId.value && rail.dockedShown.value"
      class="rail-docked"
      :aria-label="t('rail.title')"
    >
      <RailSummary v-bind="cards" @stop="stopTask" />
    </aside>
  </Transition>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import RailSummary from "@features/session-rail/components/RailSummary.vue"
import { useRailCards } from "@features/session-rail/hooks/use-rail-cards.js"
import { useSessionRail } from "@features/session-rail/index.js"

const { t } = useI18n()
const rail = useSessionRail()!
const { session, cards, stopTask } = useRailCards()
</script>

<style scoped>
.rail-docked {
  inline-size: var(--rail-width);
  min-block-size: 0;
  padding: var(--space-xs) var(--border-width) var(--space-sm);
  overflow-y: auto;
  scrollbar-width: none;
}

.rail-docked.fade-leave-active {
  position: absolute;
  inset-block-start: 0;
  inset-inline-end: 0;
}
</style>
