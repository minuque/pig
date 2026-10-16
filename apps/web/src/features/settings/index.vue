<template>
  <div class="settings-page">
    <div class="settings-column">
      <h1 class="page-title">{{ title }}</h1>
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useRoute } from "vue-router"
import { useI18n } from "@i18n/index.js"

const TITLES = {
  "settings-general": "settings.general",
  "settings-usage": "settings.usage",
  "settings-skills": "settings.skills",
  "settings-extensions": "settings.extensions",
} as const
const { t } = useI18n()
const route = useRoute()
const title = computed(() => {
  const key = TITLES[route.name as keyof typeof TITLES]
  return key ? t(key) : ""
})
</script>

<style scoped>
.settings-page {
  display: flex;
  min-height: 0;
  flex: 1;
  justify-content: center;
  padding: var(--spacing-lg);
  overflow: auto;
  background: var(--background);
}

.settings-column {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  width: 100%;
  max-width: var(--size-settings);
}

.page-title {
  margin: 0;
  color: var(--contrast-foreground);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-title--line-height);
}
</style>
