<template>
  <nav class="nav-body session-list">
    <div v-if="sbState === 'icon'" class="rail">
      <button
        v-for="row in railRows"
        :key="row.key"
        class="rail-dot"
        :class="{ active: row.session.id === highlightedSessionId }"
        type="button"
        :title="`${workspaceName(row.session.cwd ?? '')} / ${row.session.title}`"
        @click="onRailClick(row.session.id)"
      >
        <FolderIcon :size="14" />
        <span v-if="sessionState(row.session.id) === 'running'" class="rail-run motion-spin"></span>
        <span v-if="pinnedIds.has(row.session.id)" class="rail-pin"></span>
      </button>

      <button
        class="rail-dot"
        type="button"
        :title="t('session.newSession')"
        @click="emit('create')"
      >
        <PenIcon :size="14" />
      </button>
    </div>

    <div
      v-else-if="flatRows.length"
      v-bind="containerProps"
      class="session-window"
      @click.self="clearSelection"
    >
      <ul ref="listEl" v-bind="wrapperProps">
        <li
          v-for="{ data, index } in list"
          :key="data.key"
          class="session-row"
          :data-id="data.kind === 'session' ? data.session.id : undefined"
          :data-index="index"
          :data-pinned="data.kind === 'session' && pinnedIds.has(data.session.id)"
        >
          <SessionItem
            v-if="data.kind === 'session'"
            v-bind="itemBind(data.session)"
            @navigate="emit('navigate', data.session.cwd)"
            @toggle-pinned="togglePinned"
            @rename="renameSession"
            @delete="deleteSession"
            @project-settings="emit('projectSettings', $event)"
            @toggle-select="toggleSelect"
            @range-select="rangeSelect"
          />

          <button
            v-else
            class="more-button"
            type="button"
            @click="toggleGroupReveal(data.groupKey)"
          >
            {{ data.revealed ? t("common.collapse") : t("common.showMore") }}
          </button>
        </li>
      </ul>

      <div v-if="dragging" class="drop-zone pinned" :class="{ hot: dropTarget === 'pin' }">
        <span class="drop-label">Pinned</span>
      </div>

      <div
        v-if="dragging && pinnedIds.size"
        class="drop-zone active"
        :class="{ hot: dropTarget === 'unpin' }"
      >
        <span class="drop-label">Active</span>
      </div>
    </div>

    <div v-else-if="listedSessions.length" class="session-empty">{{ t("session.empty") }}</div>

    <div v-if="selectedIds.size" class="bulk-bar">
      <span class="bulk-count">{{ selectedIds.size }}</span>

      <button class="bulk-btn" type="button" @click="pinSelected">
        <PinIcon :size="12" />
        {{ t("session.pin") }}
      </button>

      <button class="bulk-btn danger" type="button" @click="deleteSelected">
        <TrashBinMinimalisticIcon :size="12" />
        {{ t("session.deleteTitle") }}
      </button>

      <button class="bulk-btn" type="button" @click="clearSelection">
        {{ t("common.cancel") }}
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, shallowRef, useTemplateRef } from "vue"
import { useTimestamp, useVirtualList } from "@vueuse/core"
import { useI18n } from "@i18n/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { filterSessionsForSearch } from "@features/session-nav/lib/session-list.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { FolderIcon, PenIcon, PinIcon, TrashBinMinimalisticIcon } from "@components/icons/index.js"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"

const props = defineProps<{
  scopeFilter?: string | undefined
  query?: string
}>()
const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  projectSettings: [project: string]
  create: []
}>()
const listEl = useTemplateRef<HTMLElement>("listEl")
const { t } = useI18n()
const {
  cardFootById,
  listedSessions,
  toggleGroupReveal,
  rowsFor,
  pinnedIds,
  togglePinned,
  highlightedSessionId,
  openSession,
  renameSession,
  deleteSession,
} = useNav()
const { sbState } = useLeftPanelToggle()
const now = useTimestamp({ interval: 60_000 })
const selectedIds = shallowRef<ReadonlySet<string>>(new Set())
const dragging = ref(false)
const dropTarget = ref<"pin" | "unpin" | null>(null)
const rawRows = rowsFor(computed(() => Boolean(props.query?.trim())))
const flatRows = computed(() => {
  const needle = props.query?.trim()
  const allowed = needle
    ? new Set(filterSessionsForSearch(listedSessions.value, needle).map((session) => session.id))
    : undefined
  return rawRows.value.filter((row) => {
    if (row.kind !== "session") return !needle

    if (allowed && !allowed.has(row.session.id)) return false
    return !props.scopeFilter || workspaceName(row.session.cwd ?? "") === props.scopeFilter
  })
})
/* icon rail 只给前 40 个会话入口，其余走 scope filter 或搜索。 */
const railRows = computed(() =>
  flatRows.value
    .filter((row) => row.kind === "session")
    .slice(0, 40)
    .map((row) => row as { kind: "session"; key: string; session: SidebarSession }),
)
const ROW_HEIGHT = 52
const {
  list,
  containerProps: virtualContainer,
  wrapperProps,
} = useVirtualList(flatRows, {
  itemHeight: ROW_HEIGHT,
  overscan: 8,
})
const containerProps = computed(() => ({
  ...virtualContainer,
  style: { ...(virtualContainer.style as { overflowY: "auto" }), scrollbarWidth: "none" as const },
}))

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function onRailClick(id: string) {
  const row = railRows.value.find((r) => r.session.id === id)
  emit("navigate", row?.session.cwd)
  openSession(id)
}

const lastSelectId = shallowRef<string>()

function sessionIds(): string[] {
  return flatRows.value.flatMap((row) => (row.kind === "session" ? [row.session.id] : []))
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)

  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
  lastSelectId.value = id
}

function rangeSelect(id: string) {
  const ids = sessionIds()
  const anchor = lastSelectId.value
  const start = anchor ? ids.indexOf(anchor) : -1
  const end = ids.indexOf(id)

  if (start < 0 || end < 0) return toggleSelect(id)
  const next = new Set(selectedIds.value)
  const [from, to] = start < end ? [start, end] : [end, start]

  for (const item of ids.slice(from, to + 1)) next.add(item)
  selectedIds.value = next
}

function clearSelection() {
  selectedIds.value = new Set()
}

function pinSelected() {
  for (const id of selectedIds.value) {
    if (!pinnedIds.value.has(id)) togglePinned(id)
  }

  selectedIds.value = new Set()
}

function deleteSelected() {
  for (const id of selectedIds.value) deleteSession(id)
  selectedIds.value = new Set()
}

function itemBind(session: SidebarSession) {
  const foot = cardFootById.value.get(session.id)
  return {
    session,
    active: session.id === highlightedSessionId.value,
    pinned: pinnedIds.value.has(session.id),
    selected: selectedIds.value.has(session.id),
    state: foot?.state,
    runningSince: foot?.runningSince,
    placeholder: session.draft ?? false,
    now: now.value,
  }
}

/* ============ 拖拽 pin/unpin ============ */
let gesture: {
  id: string
  x0: number
  y0: number
  mode: "move" | "sweep" | null
  swept: Set<string>
} | null = null

function markSwept(ids: ReadonlySet<string>) {
  listEl.value?.querySelectorAll<HTMLElement>(".session-row").forEach((row) => {
    row.classList.toggle("swept", ids.has(row.dataset.id ?? ""))
  })
}

function onRowPointerDown(e: PointerEvent) {
  if (e.button !== 0) return
  const target = e.target

  if (!(target instanceof Element) || target.closest("button, input")) return
  const row = target.closest(".session-row")
  const id = row instanceof HTMLElement ? row.dataset.id : undefined

  if (!id) return
  gesture = { id, x0: e.clientX, y0: e.clientY, mode: null, swept: new Set() }
}

function onListPointerMove(e: PointerEvent) {
  if (!gesture) return
  const dx = e.clientX - gesture.x0
  const dy = e.clientY - gesture.y0

  if (!gesture.mode) {
    if (Math.abs(dy) > 6 && Math.abs(dy) > Math.abs(dx)) gesture.mode = "move"
    else if (dx > 24 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      gesture.mode = "sweep"
      gesture.swept.add(gesture.id)
    } else return
  }

  if (gesture.mode === "sweep") {
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest(".session-row")
    const ids = sessionIds()
    const from = ids.indexOf(gesture.id)
    const to = under instanceof HTMLElement && under.dataset.id ? ids.indexOf(under.dataset.id) : -1
    const start = from < 0 || to < 0 ? -1 : Math.min(from, to)
    const end = from < 0 || to < 0 ? -1 : Math.max(from, to)
    gesture.swept = new Set(start < 0 ? [gesture.id] : ids.slice(start, end + 1))
    markSwept(gesture.swept)
    return
  }

  dragging.value = true
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const zone = el?.closest(".drop-zone")
  const row = el?.closest(".session-row")
  const rowId = row instanceof HTMLElement ? row.dataset.id : undefined
  const overPinned = Boolean(
    zone?.classList.contains("pinned") || (rowId && pinnedIds.value.has(rowId)),
  )

  dropTarget.value = overPinned ? "pin" : "unpin"
}

function onListPointerUp() {
  if (!gesture) return

  if (gesture.mode === "sweep") {
    const ids = [...gesture.swept]
    const unpin = ids.length > 0 && ids.every((id) => pinnedIds.value.has(id))

    for (const id of ids) {
      if (unpin === pinnedIds.value.has(id)) togglePinned(id)
    }
  } else if (gesture.mode === "move" && dropTarget.value) {
    const pinned = pinnedIds.value.has(gesture.id)

    if ((dropTarget.value === "pin") !== pinned) togglePinned(gesture.id)
  }

  markSwept(new Set())
  gesture = null
  dragging.value = false
  dropTarget.value = null
}

onMounted(() => {
  listEl.value?.addEventListener("pointerdown", onRowPointerDown)
  document.addEventListener("pointermove", onListPointerMove)
  document.addEventListener("pointerup", onListPointerUp)
})

onBeforeUnmount(() => {
  document.removeEventListener("pointermove", onListPointerMove)
  document.removeEventListener("pointerup", onListPointerUp)
})
</script>

<style scoped>
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.session-list {
  position: relative;
  gap: var(--spacing-xxs);
}

.session-window {
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-list ul {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-row {
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.session-row.swept :deep(.session-card) {
  background: var(--success-halo);
}

.more-button {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding-block: var(--spacing-xxs);
  overflow-y: auto;
  scrollbar-width: none;
}

.rail-dot {
  position: relative;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-faint);
  cursor: pointer;
}

.rail-run {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  border: 1.5px solid var(--primary);
  border-top-color: transparent;
  border-radius: var(--radius-full);
}

.rail-pin {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--contrast-foreground-faint);
}

.rail-dot:hover {
  background: var(--sidebar-hover);
  color: var(--contrast-foreground);
}

.rail-dot.active {
  background: var(--sidebar-selected);
  color: var(--primary);
}

.session-empty {
  padding: var(--spacing-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

.drop-zone {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  height: 0;
  overflow: hidden;
  padding-inline: var(--spacing-sm);
  font-size: var(--text-eyebrow);
  color: var(--contrast-foreground-faint);
  transition:
    height var(--duration-fast) var(--ease-out),
    color var(--duration-fast);
}

.drop-zone .drop-label {
  flex: none;
  font-weight: var(--font-weight-bold);
}

.drop-zone::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}

.drop-zone.pinned {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--sidebar);
}

.drop-zone.active {
  position: sticky;
  bottom: 0;
  z-index: 2;
  background: var(--sidebar);
}

.session-window:has(.session-row[data-dragging]) .drop-zone,
.drop-zone.hot {
  height: 22px;
}

.drop-zone.hot {
  color: var(--primary);
}

.drop-zone.hot::after {
  background: var(--primary);
  opacity: 0.5;
}

.bulk-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-block-start: 1px solid var(--border);
  background: var(--sidebar);
  flex: none;
}

.bulk-count {
  display: grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding-inline: 4px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--primary-foreground);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-bold);
}

.bulk-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-eyebrow);
}

.bulk-btn:hover {
  background: var(--hover-quiet);
}

.bulk-btn.danger {
  color: var(--destructive);
}

.bulk-btn:last-child {
  margin-inline-start: auto;
}
</style>
