import { useIntervalFn } from "@vueuse/core"
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue"
import { sessionArchives } from "@client/session-archives.js"
import {
  ARCHIVE_BATCH_STEP,
  ARCHIVE_INITIAL_BATCH,
  buildArchiveRows,
  collectProjectOptions,
  countArchiveTabs,
  countQuickRules,
  filterArchiveRows,
  flattenArchiveGroups,
  groupArchiveRows,
  idsMatchingQuickRule,
  type ArchiveController,
  type ArchiveProjectGroup,
  type ArchiveQuickRule,
  type ArchiveSessionRow,
  type ArchiveTab,
} from "@features/settings/lib/archive-view.js"
import { useI18n } from "@i18n/index.js"

export const ALL_PROJECTS = "__all__"

export interface QuickRuleChip {
  readonly rule: ArchiveQuickRule
  readonly label: string
  readonly active: boolean
}

export function useArchivePane(controller: () => ArchiveController) {
  const { t } = useI18n()
  const tab = ref<ArchiveTab>("inbox")
  const projectFilter = ref<string>(ALL_PROJECTS)
  const query = ref("")
  const selectedIds = ref(new Set<string>())
  const loadedLimit = ref(ARCHIVE_INITIAL_BATCH)
  const now = shallowRef(Date.now())
  const staleNow = shallowRef(Date.now())
  const pendingDelete = ref<ArchiveSessionRow[]>([])
  const deleteDialogOpen = ref(false)
  let loadQueued = false
  let loadRaf: number | undefined

  useIntervalFn(() => {
    now.value = Date.now()
  }, 30_000)

  useIntervalFn(() => {
    staleNow.value = Date.now()
  }, 300_000)

  onScopeDispose(() => {
    if (loadRaf !== undefined) cancelAnimationFrame(loadRaf)
    loadRaf = undefined
    loadQueued = false
  })

  const tabCounts = computed(() =>
    countArchiveTabs(controller().allSessions.value, sessionArchives.value),
  )
  const inboxCount = computed(() => tabCounts.value.inbox)
  const archivedCount = computed(() => tabCounts.value.archived)
  const activeRows = computed(() => {
    const active = controller()
    return buildArchiveRows({
      sessions: active.allSessions.value,
      archives: sessionArchives.value,
      settledIds: active.settledIds.value,
      runningIds: active.runningIds.value,
      cardFootById: active.cardFootById.value,
      tab: tab.value,
      untitledLabel: t("session.untitled"),
      now: staleNow.value,
    })
  })
  const projectOptions = computed(() => {
    const active = controller()
    return collectProjectOptions(active.allSessions.value, active.projectByCwd.value)
  })
  const filteredRows = computed(() =>
    filterArchiveRows(
      activeRows.value,
      projectFilter.value === ALL_PROJECTS ? "" : projectFilter.value,
      query.value,
    ),
  )
  const groups = computed(() =>
    groupArchiveRows(filteredRows.value, controller().projectByCwd.value),
  )
  const hasMoreRows = computed(() => loadedLimit.value < filteredRows.value.length)
  const virtualItems = computed(() =>
    flattenArchiveGroups(groups.value, loadedLimit.value, filteredRows.value.length),
  )
  const selectableVisibleIds = computed(() =>
    filteredRows.value.filter((row) => !row.running).map((row) => row.id),
  )

  watch([tab, projectFilter, query], () => {
    loadedLimit.value = ARCHIVE_INITIAL_BATCH
  })

  watch(selectableVisibleIds, (visible) => {
    const allowed = new Set(visible)
    let changed = false
    const next = new Set<string>()

    for (const id of selectedIds.value) {
      if (allowed.has(id)) next.add(id)
      else changed = true
    }

    if (changed) selectedIds.value = next
  })

  watch(projectOptions, (options) => {
    if (
      projectFilter.value !== ALL_PROJECTS &&
      !options.some((option) => option.cwd === projectFilter.value)
    ) {
      projectFilter.value = ALL_PROJECTS
    }
  })

  const selectedCount = computed(() => selectedIds.value.size)
  const masterCheckState = computed<boolean | "indeterminate">(() => {
    const total = selectableVisibleIds.value.length

    if (total === 0) return false
    let checked = 0

    for (const id of selectableVisibleIds.value) {
      if (selectedIds.value.has(id)) checked += 1
    }

    if (checked === 0) return false
    return checked === total ? true : "indeterminate"
  })
  const quickRuleCounts = computed(() => countQuickRules(filteredRows.value))

  function isRuleSelected(rule: ArchiveQuickRule): boolean {
    const ids = idsMatchingQuickRule(filteredRows.value, rule)
    return ids.length > 0 && ids.every((id) => selectedIds.value.has(id))
  }

  const visibleQuickRules = computed<QuickRuleChip[]>(() => {
    const specs: Array<{ rule: ArchiveQuickRule; key: string }> = [
      { rule: "stale", key: "settings.archive.pickStale" },
      { rule: "settled", key: "settings.archive.pickSettled" },
      { rule: "error", key: "settings.archive.pickError" },
    ]
    const counts = quickRuleCounts.value
    const chips: QuickRuleChip[] = []

    for (const { rule, key } of specs) {
      const count = counts[rule]

      if (count > 0) {
        chips.push({ rule, label: t(key, { count }), active: isRuleSelected(rule) })
      }
    }

    return chips
  })
  const emptyMessage = computed(() => {
    const filtered = projectFilter.value !== ALL_PROJECTS || query.value.trim().length > 0

    if (tab.value === "inbox") {
      return filtered
        ? t("settings.archive.emptyInboxFiltered")
        : t("settings.archive.emptyInboxTitle")
    }

    return filtered
      ? t("settings.archive.emptyArchivedFiltered")
      : t("settings.archive.emptyArchivedTitle")
  })
  const deleteDialogTitle = computed(() =>
    pendingDelete.value.length > 1
      ? t("settings.archive.deleteConfirmBatchTitle", { count: pendingDelete.value.length })
      : t("session.deleteTitle"),
  )
  const deleteDialogDescription = computed(() =>
    pendingDelete.value.length > 1
      ? t("settings.archive.deleteConfirmBatchDescription")
      : t("session.deleteBody", { title: pendingDelete.value[0]?.title ?? "" }),
  )

  function loadMoreRows(): void {
    const total = filteredRows.value.length

    if (loadedLimit.value >= total) return
    loadedLimit.value = Math.min(total, loadedLimit.value + ARCHIVE_BATCH_STEP)
  }

  function scheduleLoadMore(): void {
    if (loadQueued || !hasMoreRows.value) return
    loadQueued = true
    loadRaf = requestAnimationFrame(() => {
      loadRaf = undefined
      loadQueued = false
      loadMoreRows()
    })
  }

  function setTab(next: ArchiveTab): void {
    tab.value = next
    selectedIds.value = new Set()
  }

  function clearSelection(): void {
    selectedIds.value = new Set()
  }

  function toggleSelectAll(): void {
    if (masterCheckState.value === true) clearSelection()
    else selectedIds.value = new Set(selectableVisibleIds.value)
  }

  function toggleSelectOne(id: string): void {
    const next = new Set(selectedIds.value)

    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function groupCheckState(group: ArchiveProjectGroup): boolean | "indeterminate" {
    const total = group.selectableIds.length

    if (total === 0) return false
    let checked = 0

    for (const id of group.selectableIds) {
      if (selectedIds.value.has(id)) checked += 1
    }

    if (checked === 0) return false
    return checked === total ? true : "indeterminate"
  }

  function toggleGroupSelect(group: ArchiveProjectGroup): void {
    const next = new Set(selectedIds.value)
    const allChecked = groupCheckState(group) === true

    for (const id of group.selectableIds) {
      if (allChecked) next.delete(id)
      else next.add(id)
    }

    selectedIds.value = next
  }

  function toggleQuickRule(rule: ArchiveQuickRule): void {
    const ids = idsMatchingQuickRule(filteredRows.value, rule)
    const next = new Set(selectedIds.value)
    const active = isRuleSelected(rule)

    for (const id of ids) {
      if (active) next.delete(id)
      else next.add(id)
    }

    selectedIds.value = next
  }

  function removeFromSelection(ids: readonly string[]): void {
    const next = new Set(selectedIds.value)

    for (const id of ids) next.delete(id)
    selectedIds.value = next
  }

  async function archiveIds(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    removeFromSelection(ids)
    await controller().archiveSessions(ids)
  }

  async function unarchiveIds(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    removeFromSelection(ids)
    await controller().unarchiveSessions(ids)
  }

  function runBatchPrimary(): void {
    const ids = [...selectedIds.value]

    if (tab.value === "inbox") void archiveIds(ids)
    else void unarchiveIds(ids)
  }

  function requestDeleteOne(row: ArchiveSessionRow): void {
    if (row.running) return
    pendingDelete.value = [row]
    deleteDialogOpen.value = true
  }

  function requestDeleteBatch(): void {
    const selected = filteredRows.value.filter(
      (row) => !row.running && selectedIds.value.has(row.id),
    )

    if (selected.length === 0) return
    pendingDelete.value = selected
    deleteDialogOpen.value = true
  }

  async function confirmDelete(): Promise<void> {
    const ids = pendingDelete.value.map((row) => row.id)

    deleteDialogOpen.value = false
    pendingDelete.value = []
    removeFromSelection(ids)
    await controller().deleteSessions(ids)
  }

  return {
    tab,
    projectFilter,
    query,
    now,
    selectedIds,
    inboxCount,
    archivedCount,
    filteredRows,
    virtualItems,
    hasMoreRows,
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
    loadMoreRows,
    scheduleLoadMore,
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
  }
}
