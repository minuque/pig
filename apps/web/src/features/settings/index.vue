<template>
  <Dialog :open="open" @update:open="onOpen">
    <DialogContent
      class="settings-dialog flex h-[min(80vh,52rem)] w-[min(var(--size-settings),calc(100vw-2rem))] max-w-[min(var(--size-settings),calc(100vw-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(var(--size-settings),calc(100vw-2rem))] sm:p-0"
    >
      <div class="settings">
        <nav class="nav" aria-label="设置">
          <button
            v-for="item in tabs"
            :key="item.id"
            type="button"
            class="nav-item"
            :aria-current="tab === item.id ? 'page' : undefined"
            @click="tab = item.id"
          >
            <component :is="item.icon" class="size-icon" :stroke-width="1.75" />
            {{ item.label }}
          </button>
        </nav>
        <section class="main">
          <header class="main-head">
            <DialogTitle>{{ activeLabel }}</DialogTitle>
          </header>
          <div class="main-body">
            <GeneralPane v-if="tab === 'general'" />
            <UsagePane v-else-if="tab === 'usage'" />
            <SkillsPane v-else-if="tab === 'skills'" />
            <ExtensionsPane v-else />
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { Blocks, ChartNoAxesCombined, Puzzle, SlidersHorizontal } from "lucide-vue-next"
import { Dialog, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import ExtensionsPane from "@features/settings/components/ExtensionsPane.vue"
import GeneralPane from "@features/settings/components/GeneralPane.vue"
import SkillsPane from "@features/settings/components/SkillsPane.vue"
import UsagePane from "@features/settings/components/UsagePane.vue"
import { useSettings, type SettingsTab } from "@features/settings/index.js"

const { open, tab } = useSettings()

const tabs: { id: SettingsTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "general", label: "通用", icon: SlidersHorizontal },
  { id: "usage", label: "用量", icon: ChartNoAxesCombined },
  { id: "skills", label: "技能", icon: Blocks },
  { id: "extensions", label: "扩展", icon: Puzzle },
]

const activeLabel = computed(() => tabs.find((item) => item.id === tab.value)?.label ?? "通用")

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
  border-inline-end: var(--border-width) solid var(--hairline);
  background: var(--sidebar);
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
.main-head {
  display: flex;
  flex: none;
  align-items: center;
  min-height: var(--size-control);
  padding: var(--spacing-md) var(--spacing-xxl) var(--spacing-sm) var(--spacing-lg);
}
.main-body {
  min-height: 0;
  flex: 1;
  padding: 0 var(--spacing-lg) var(--spacing-lg);
  overflow: auto;
}
</style>
