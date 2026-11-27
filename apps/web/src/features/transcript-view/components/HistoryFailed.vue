<template>
  <div class="history-failed">
    <EmptyState
      :title="t('session.historyFailedTitle')"
      :description="t('session.historyFailedBody')"
    >
      <template #art><HairlineArt figure="plug" /></template>
      <template #actions><RetryButton :action="retry" /></template>
    </EmptyState>
  </div>
</template>

<script setup lang="ts">
import { EmptyState } from "@pig/ui/empty-state"
import { useI18n } from "@i18n/index.js"
import HairlineArt from "@components/empty/HairlineArt.vue"
import RetryButton from "@components/empty/RetryButton.vue"

defineProps<{ retry: () => unknown }>()

const { t } = useI18n()
</script>

<style scoped>
.history-failed {
  position: absolute;
  inset: 0 0 var(--composer-reserve, 0px) 0;
  z-index: var(--z-overlay);
  display: flex;
  flex-direction: column;
}
</style>
