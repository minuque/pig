<template>
  <div class="archive-pane">
    <ArchiveToolbar
      v-model:project-filter="projectFilter"
      v-model:query="query"
      :tab="tab"
      :inbox-count="inboxRows.length"
      :archived-count="archivedRows.length"
      :project-options="projectOptions"
      :has-rows="filteredRows.length > 0"
      :has-selectable="selectableVisibleIds.length > 0"
      :master-check-state="masterCheckState"
      :quick-rules="visibleQuickRules"
      :selected-count="selectedCount"
      @change-tab="setTab"
      @toggle-select-all="toggleSelectAll"
      @toggle-quick-rule="toggleQuickRule"
      @clear-selection="clearSelection"
    />

    <div v-if="groups.length > 0" class="group-list">
      <section v-for="group in groups" :key="group.project.cwd" class="project-section">
        <div class="project-head">
          <div class="project-meta">
            <Checkbox
              :model-value="groupCheckState(group)"
              :disabled="group.selectableIds.length === 0"
              :aria-label="t('settings.archive.selectProject', { name: group.project.name })"
              @update:model-value="toggleGroupSelect(group)"
            />

            <span
              v-if="projectIcon(group.project.iconName)"
              class="project-mark"
              :data-tone="group.project.tone"
              aria-hidden="true"
            >
              <component :is="projectIcon(group.project.iconName)" class="size-icon" />
            </span>

            <Badge
              v-else
              variant="soft"
              size="s"
              :color="group.project.tone"
              class="project-monogram"
            >
              {{ group.project.monogram }}
            </Badge>

            <span class="project-name">{{ group.project.name }}</span>
            <span class="project-count tabular">{{ group.rows.length }}</span>
            <span v-if="group.project.host" class="project-host">{{ group.project.host }}</span>
          </div>

          <Button
            v-if="tab === 'inbox' && group.staleIds.length > 0"
            variant="ghost"
            size="s"
            class="group-stale-action"
            @click="archiveGroupStale(group)"
          >
            {{ t("settings.archive.archiveProjectStale", { count: group.staleIds.length }) }}
          </Button>
        </div>

        <CardList>
          <ArchiveRow
            v-for="row in group.rows"
            :key="row.id"
            :row="row"
            :archived="tab === 'archived'"
            :selected="selectedIds.has(row.id)"
            :now="now"
            @toggle-select="toggleSelectOne"
            @archive="archiveOne"
            @unarchive="unarchiveOne"
            @delete="requestDeleteOne"
          />
        </CardList>
      </section>
    </div>

    <div v-else class="archive-empty">
      <ArchiveIcon class="empty-icon" />
      <p class="empty-text">{{ emptyMessage }}</p>
    </div>

    <div v-if="selectedCount > 0" class="bulk-bar">
      <span class="bulk-count tabular">
        {{ t("settings.archive.selectedCount", { count: selectedCount }) }}
      </span>

      <div class="bulk-actions">
        <Button size="s" variant="solid" @click="runBatchPrimary">
          {{
            tab === "inbox"
              ? t("settings.archive.batchArchive")
              : t("settings.archive.batchUnarchive")
          }}
        </Button>

        <Button size="s" variant="outline" color="danger" @click="requestDeleteBatch">
          {{ t("settings.archive.batchDelete") }}
        </Button>

        <Button size="s" variant="ghost" @click="clearSelection">
          {{ t("settings.archive.clearSelection") }}
        </Button>
      </div>
    </div>

    <AlertDialog v-model:open="deleteDialogOpen">
      <AlertDialogContent class="delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{{ deleteDialogTitle }}</AlertDialogTitle>
          <AlertDialogDescription>{{ deleteDialogDescription }}</AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{{ t("common.cancel") }}</AlertDialogCancel>

          <AlertDialogAction variant="destructive" @click="confirmDelete">
            {{ t("settings.archive.deleteConfirmAction") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { ArchiveIcon } from "@components/icons/index.js"
import { PROJECT_ICONS } from "@components/icons/project-icons.js"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"
import { Badge } from "@components/ui/badge/index.js"
import { Button } from "@components/ui/button/index.js"
import { CardList } from "@components/ui/card/index.js"
import { Checkbox } from "@components/ui/checkbox/index.js"
import ArchiveRow from "@features/settings/components/ArchiveRow.vue"
import ArchiveToolbar from "@features/settings/components/ArchiveToolbar.vue"
import { useArchivePane } from "@features/settings/hooks/use-archive-pane.js"
import type { ArchiveController, ArchiveProjectGroup } from "@features/settings/lib/archive-view.js"
import { useI18n } from "@i18n/index.js"

const props = defineProps<{
  controller: ArchiveController
}>()
const { t } = useI18n()
const {
  tab,
  projectFilter,
  query,
  now,
  selectedIds,
  inboxRows,
  archivedRows,
  filteredRows,
  groups,
  projectOptions,
  selectableVisibleIds,
  selectedCount,
  masterCheckState,
  visibleQuickRules,
  emptyMessage,
  deleteDialogOpen,
  deleteDialogTitle,
  deleteDialogDescription,
  setTab,
  clearSelection,
  toggleSelectAll,
  toggleSelectOne,
  groupCheckState,
  toggleGroupSelect,
  toggleQuickRule,
  archiveIds,
  unarchiveIds,
  runBatchPrimary,
  requestDeleteOne,
  requestDeleteBatch,
  confirmDelete,
} = useArchivePane(() => props.controller)

function projectIcon(name: string | undefined) {
  return name ? PROJECT_ICONS[name] : undefined
}

function archiveOne(id: string): void {
  void archiveIds([id])
}

function unarchiveOne(id: string): void {
  void unarchiveIds([id])
}

function archiveGroupStale(group: ArchiveProjectGroup): void {
  void archiveIds(group.staleIds)
}
</script>

<style scoped>
.archive-pane {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.project-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.project-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding-inline: calc(var(--space-md) + var(--border-width));
}

.project-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.project-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-control);
  background-color: var(--tone-subtle);
  color: var(--tone-text);
}

.project-monogram {
  flex-shrink: 0;
}

.project-name {
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-body--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-count {
  flex-shrink: 0;
  color: var(--fg-subtle);
  font-size: var(--text-meta);
}

.project-host {
  overflow: hidden;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-stale-action {
  flex-shrink: 0;
  color: var(--fg-muted);
}

.group-stale-action:hover {
  color: var(--fg);
}

.archive-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-2xl) var(--space-lg);
  color: var(--fg-muted);
  text-align: center;
}

.empty-icon {
  width: 1.5rem;
  height: 1.5rem;
  color: var(--fg-subtle);
}

.empty-text {
  margin: 0;
  font-size: var(--text-body);
}

.bulk-bar {
  position: sticky;
  bottom: var(--space-sm);
  z-index: var(--z-sticky);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--float-bg);
  box-shadow: var(--shadow-popover);
  backdrop-filter: blur(12px);
}

.bulk-count {
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
}

.bulk-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.tabular {
  font-variant-numeric: tabular-nums;
}

@media (min-width: 640px) {
  .delete-dialog {
    max-inline-size: 28rem;
  }
}
</style>
