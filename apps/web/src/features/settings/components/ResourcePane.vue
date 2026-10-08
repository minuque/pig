<template>
  <section class="pane">
    <p v-if="!cwd" class="empty">{{ t("settings.noCwd") }}</p>

    <template v-else>
      <p class="cwd">{{ cwd }}</p>
      <p class="empty">{{ empty }}</p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "@i18n/index.js"
import { useSettingsCwd } from "@features/settings/hooks/use-settings-cwd.js"

const { t } = useI18n()

defineProps<{ empty: string }>()

const cwd = useSettingsCwd()
</script>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.cwd {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  word-break: break-all;
}

.empty {
  margin: 0;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
