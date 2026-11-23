<template>
  <div class="archive-pane">
    <ArchiveToolbar
      v-model:project-filter="projectFilter"
      v-model:query="query"
      :tab="tab"
      :inbox-count="inboxCount"
      :archived-count="archivedCount"
      :project-options="projectOptions"
      :has-rows="filteredRows.length > 0"
      :has-selectable="selectableVisibleIds.length > 0"
      :master-check-state="masterCheckState"
      :quick-rules="visibleQuickRules"
      @change-tab="setTab"
      @toggle-select-all="toggleSelectAll"
      @toggle-quick-rule="toggleQuickRule"
    />

    <div v-show="virtualItems.length > 0" v-bind="containerProps" class="virtual-viewport">
      <div v-bind="wrapperProps">
        <template v-for="{ data } in list" :key="data.key">
          <div
            v-if="data.kind === 'group-head'"
            class="project-head"
            :data-first="data.firstGroup ? '' : undefined"
          >
            <div class="project-meta">
              <Checkbox
                :model-value="groupCheckState(data.group)"
                :disabled="data.group.selectableIds.length === 0"
                :aria-label="t('settings.archive.selectProject', { name: data.group.project.name })"
                @update:model-value="toggleGroupSelect(data.group)"
              />

              <span
                v-if="projectIcon(data.group.project.iconName)"
                class="project-mark"
                :data-tone="data.group.project.tone"
                aria-hidden="true"
              >
                <component :is="projectIcon(data.group.project.iconName)" class="size-icon" />
              </span>

              <Badge
                v-else
                variant="soft"
                size="s"
                :color="data.group.project.tone"
                class="project-monogram"
              >
                {{ data.group.project.monogram }}
              </Badge>

              <span class="project-name">{{ data.group.project.name }}</span>
              <span class="project-count tabular">{{ data.group.rows.length }}</span>

              <span v-if="data.group.project.host" class="project-host">
                {{ data.group.project.host }}
              </span>
            </div>

            <Button
              v-if="tab === 'inbox' && data.group.staleIds.length > 0"
              variant="ghost"
              size="s"
              class="group-stale-action"
              @click="archiveGroupStale(data.group)"
            >
              {{ t("settings.archive.archiveProjectStale", { count: data.group.staleIds.length }) }}
            </Button>
          </div>

          <ArchiveRow
            v-else
            :row="data.row"
            :archived="tab === 'archived'"
            :selected="selectedIds.has(data.row.id)"
            :now="now"
            :is-first="data.isFirst"
            :is-last="data.isLast"
            @toggle-select="toggleSelectOne"
            @archive="archiveOne"
            @unarchive="unarchiveOne"
            @delete="requestDeleteOne"
          />
        </template>
      </div>
    </div>

    <div v-if="virtualItems.length === 0" class="archive-empty">
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

          <AlertDialogAction color="danger" @click="confirmDelete">
            {{ t("settings.archive.deleteConfirmAction") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { useVirtualList } from "@vueuse/core"
import { nextTick, watch } from "vue"
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
} from "@pig/ui/alert-dialog"
import { Badge } from "@pig/ui/badge"
import { Button } from "@pig/ui/button"
import { Checkbox } from "@pig/ui/checkbox"
import ArchiveRow from "@features/settings/components/ArchiveRow.vue"
import ArchiveToolbar from "@features/settings/components/ArchiveToolbar.vue"
import { useArchivePane } from "@features/settings/hooks/use-archive-pane.js"
import {
  archiveVirtualItemHeight,
  type ArchiveController,
  type ArchiveProjectGroup,
} from "@features/settings/lib/archive-view.js"
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
  inboxCount,
  archivedCount,
  filteredRows,
  virtualItems,
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
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(virtualItems, {
  itemHeight: (index) => archiveVirtualItemHeight(virtualItems.value[index]),
  overscan: 6,
})

watch([tab, projectFilter, query], async () => {
  await nextTick()
  scrollTo(0)
})

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
  flex: 1;
  flex-direction: column;
  min-height: 0;
  gap: var(--space-md);
}

.virtual-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
}

.project-head {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  height: 52px;
  padding-top: var(--space-md);
  padding-inline: calc(var(--space-md) + var(--border-width));
}

.project-head[data-first] {
  height: 36px;
  padding-top: 0;
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
  color: var(--fg-muted);
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
  flex: 1;
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
  color: var(--fg-muted);
}

.empty-text {
  margin: 0;
  font-size: var(--text-body);
}

.bulk-bar {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-card);
  background: var(--float-bg);
  box-shadow: var(--float-shadow);
  backdrop-filter: var(--glass-filter);
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
