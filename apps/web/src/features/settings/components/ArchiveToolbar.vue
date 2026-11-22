<template>
  <div class="archive-toolbar">
    <TabsRoot :model-value="tab" @update:model-value="onTabChange">
      <TabsList variant="segmented" size="m">
        <TabsTrigger value="inbox">
          <span>{{ t("settings.archive.tabInbox") }}</span>
          <span class="tab-count tabular">{{ inboxCount }}</span>
        </TabsTrigger>

        <TabsTrigger value="archived">
          <span>{{ t("settings.archive.tabArchived") }}</span>
          <span class="tab-count tabular">{{ archivedCount }}</span>
        </TabsTrigger>
      </TabsList>
    </TabsRoot>

    <div class="archive-filters">
      <Select :model-value="projectFilter" @update:model-value="onProjectFilterChange">
        <SelectTrigger
          size="m"
          class="project-select"
          :aria-label="t('settings.archive.allProjects')"
        >
          <span class="project-select-label">{{ activeProjectLabel }}</span>
        </SelectTrigger>

        <SelectContent>
          <SelectItem :value="ALL_PROJECTS">{{ t("settings.archive.allProjects") }}</SelectItem>

          <SelectItem v-for="option in projectOptions" :key="option.cwd" :value="option.cwd">
            {{ option.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <TextFieldRoot
        v-model="query"
        size="m"
        class="search-input"
        :placeholder="t('settings.archive.searchPlaceholder')"
        :aria-label="t('settings.archive.searchPlaceholder')"
      >
        <TextFieldSlot>
          <SearchIcon class="size-icon" />
        </TextFieldSlot>

        <TextFieldSlot v-if="query" side="right">
          <IconButton
            size="s"
            variant="ghost"
            color="neutral"
            :aria-label="t('settings.clearSearch')"
            @click="clearQuery"
          >
            <XIcon />
          </IconButton>
        </TextFieldSlot>
      </TextFieldRoot>
    </div>
  </div>

  <div v-if="hasRows" class="triage-bar">
    <div class="triage-left">
      <Checkbox
        :model-value="masterCheckState"
        :disabled="!hasSelectable"
        :aria-label="t('settings.archive.selectAll')"
        @update:model-value="emit('toggleSelectAll')"
      />

      <span v-if="tab !== 'inbox' || quickRules.length === 0" class="select-all-text">
        {{ t("settings.archive.selectAll") }}
      </span>

      <div v-if="tab === 'inbox' && quickRules.length > 0" class="quick-rules">
        <Button
          v-for="item in quickRules"
          :key="item.rule"
          variant="ghost"
          size="s"
          :class="['quick-chip', { 'is-active': item.active }]"
          @click="emit('toggleQuickRule', item.rule)"
        >
          {{ item.label }}
        </Button>
      </div>
    </div>

    <div v-if="selectedCount > 0" class="triage-right">
      <span class="selected-meta tabular">
        {{ t("settings.archive.selectedCount", { count: selectedCount }) }}
      </span>

      <Button variant="ghost" size="s" @click="emit('clearSelection')">
        {{ t("settings.archive.clearSelection") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { SearchIcon, XIcon } from "@components/icons/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { Checkbox } from "@components/ui/checkbox/index.js"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@components/ui/select/index.js"
import { TabsList, TabsRoot, TabsTrigger } from "@components/ui/tabs/index.js"
import { TextFieldRoot, TextFieldSlot } from "@components/ui/text-field/index.js"
import { ALL_PROJECTS, type QuickRuleChip } from "@features/settings/hooks/use-archive-pane.js"
import type {
  ArchiveProjectView,
  ArchiveQuickRule,
  ArchiveTab,
} from "@features/settings/lib/archive-view.js"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{
  tab: ArchiveTab
  inboxCount: number
  archivedCount: number
  projectOptions: readonly ArchiveProjectView[]
  hasRows: boolean
  hasSelectable: boolean
  masterCheckState: boolean | "indeterminate"
  quickRules: readonly QuickRuleChip[]
  selectedCount: number
}>()
const projectFilter = defineModel<string>("projectFilter", { required: true })
const query = defineModel<string>("query", { required: true })
const emit = defineEmits<{
  changeTab: [tab: ArchiveTab]
  toggleSelectAll: []
  toggleQuickRule: [rule: ArchiveQuickRule]
  clearSelection: []
}>()
const { t } = useI18n()
const activeProjectLabel = computed(() => {
  if (projectFilter.value === ALL_PROJECTS) return t("settings.archive.allProjects")
  return (
    props.projectOptions.find((option) => option.cwd === projectFilter.value)?.name ??
    t("settings.archive.allProjects")
  )
})

function onTabChange(next: string | number): void {
  if (next === "inbox" || next === "archived") emit("changeTab", next)
}

function onProjectFilterChange(value: unknown): void {
  projectFilter.value = typeof value === "string" && value ? value : ALL_PROJECTS
}

function clearQuery(): void {
  query.value = ""
}
</script>

<style scoped>
.archive-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.tab-count {
  margin-inline-start: var(--space-2xs);
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.archive-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs);
  margin-inline-start: auto;
}

.project-select {
  min-width: 8.5rem;
  max-width: 13rem;
}

.project-select-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-input {
  width: 13rem;
}

.triage-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-xs);
  padding-inline: calc(var(--space-md) + var(--border-width));
}

.triage-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-sm);
}

.select-all-text {
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.quick-rules {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2xs);
}

.quick-chip {
  color: var(--fg-muted);
}

.quick-chip:hover {
  color: var(--fg);
}

.quick-chip.is-active {
  background-color: var(--bg-selected);
  color: var(--fg);
}

.triage-right {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-inline-start: auto;
}

.selected-meta {
  color: var(--fg-muted);
  font-size: var(--text-meta);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 639px) {
  .archive-filters {
    width: 100%;
    margin-inline-start: 0;
  }

  .search-input {
    flex: 1;
    width: auto;
  }
}
</style>
