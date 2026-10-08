<template>
  <section class="pane">
    <p class="empty">{{ t("settings.noUsage") }}</p>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"

const { t } = useI18n()
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
