<template>
  <Dialog :open="open" @update:open="onOpen">
    <DialogContent
      aria-describedby="settings-copy"
      class="settings-dialog flex h-[min(80vh,52rem)] w-[min(var(--size-settings),calc(100vw-2rem))] max-w-[min(var(--size-settings),calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(var(--size-settings),calc(100vw-2rem))] sm:p-0"
    >
      <DialogTitle class="sr-only">{{ activeLabel }}</DialogTitle>
      <p id="settings-copy" class="sr-only">{{ t("settings.copy") }}</p>

      <div class="settings">
        <nav class="nav" :aria-label="t('settings.title')">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="nav-item"
            :aria-current="tab === item.id ? 'page' : undefined"
            @click="tab = item.id"
          >
            <component :is="item.icon" class="size-icon" />
            {{ item.label }}
          </button>
        </nav>

        <section class="main">
          <div class="main-body">
            <GeneralPane v-if="tab === 'general'" />
            <UsagePane v-else-if="tab === 'usage'" />
            <ResourcePane v-else-if="tab === 'skills'" :empty="t('settings.noSkills')" />
            <ResourcePane v-else :empty="t('settings.noExtensions')" />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Blocks, ChartNoAxesCombined, Puzzle, SlidersHorizontal } from "@lucide/vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import GeneralPane from "@features/settings/components/GeneralPane.vue"
import ResourcePane from "@features/settings/components/ResourcePane.vue"
import UsagePane from "@features/settings/components/UsagePane.vue"
import { useSettings, type SettingsTab } from "@features/settings/index.js"

const { t } = useI18n()
const { open, tab } = useSettings()
const tabs = computed<{ id: SettingsTab; label: string; icon: typeof SlidersHorizontal }[]>(() => [
  { id: "general", label: t("settings.general"), icon: SlidersHorizontal },
  { id: "usage", label: t("settings.usage"), icon: ChartNoAxesCombined },
  { id: "skills", label: t("settings.skills"), icon: Blocks },
  { id: "extensions", label: t("settings.extensions"), icon: Puzzle },
])
const activeLabel = computed(
  () => tabs.value.find((item) => item.id === tab.value)?.label ?? t("settings.general"),
)

function onOpen(next: boolean) {
  if (next) tab.value = "general"
  open.value = next
}
</script>

<style scoped>
.settings {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.nav {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xxs);
  width: var(--size-settings-nav);
  padding: var(--spacing-sm);
  overflow: auto;
  border-inline-end: var(--border-width) solid var(--border);
  background: var(--surface);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: var(--spacing-xxs) var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-align: start;
}

.nav-item:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.nav-item[aria-current="page"] {
  background: var(--interaction-selected);
  color: var(--ink);
}

.main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  background: var(--surface);
}

.main-body {
  min-height: 0;
  flex: 1;
  padding: var(--spacing-md) var(--spacing-lg) var(--spacing-lg);
  overflow: auto;
}
</style>
