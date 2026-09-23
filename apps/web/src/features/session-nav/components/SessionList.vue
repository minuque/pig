<template>
  <nav class="nav-body session-list">
    <section v-if="pinnedRows.length" class="nav-section">
      <div class="section-label">
        <span class="section-label-text">置顶</span>

        <button
          class="section-fold"
          type="button"
          :aria-expanded="!collapsedSections.pinned"
          :aria-label="collapsedSections.pinned ? '展开置顶' : '折叠置顶'"
          @click="collapsedSections.pinned = !collapsedSections.pinned"
        >
          <ChevronDown v-if="!collapsedSections.pinned" class="size-icon" />
          <ChevronRight v-else class="size-icon" />
        </button>
      </div>

      <div v-if="!collapsedSections.pinned" class="group-body">
        <SessionItem
          v-for="session in pinnedRows"
          :key="session.id"
          v-bind="itemBind(session, { pinned: true, showPath: true })"
          @navigate="emit('navigate', session.cwd)"
          @toggle-pinned="togglePinned"
          @rename="renameSession"
          @delete="deleteSession"
        />
      </div>
    </section>

    <SessionsHead
      v-if="connected || groups.length"
      :view="view"
      :sort="sort"
      :all-collapsed="allCollapsed"
      :can-fold="view === 'grouped' && groupRows.length > 0"
      @toggle-all="toggleAllGroups"
      @set-view="setView"
      @set-sort="setSort"
    />

    <ul v-if="view === 'flat' && updatedSessions.length" class="flat-sessions">
      <li v-for="session in updatedSessions" :key="session.id">
        <SessionItem
          v-bind="itemBind(session)"
          @navigate="emit('navigate', session.cwd)"
          @toggle-pinned="togglePinned"
          @rename="renameSession"
          @delete="deleteSession"
        />
      </li>

      <li v-if="updatedMore">
        <button class="more-button" type="button" @click="toggleGroupReveal('updated')">
          {{ updatedMore.revealed ? "收起" : "显示更多" }}
        </button>
      </li>
    </ul>

    <ul v-else-if="view === 'grouped' && showList">
      <li
        v-for="section in listSections"
        :key="section.key"
        :class="groupClass(section.key, section.open)"
        @dragover.prevent="onGroupDragOver(section.key, $event)"
        @drop.prevent="onGroupDrop(section.key)"
        @dragend="clearGroupDrag"
      >
        <GroupHead
          :name="section.name"
          :kind="section.kind"
          :sortable="sort === 'manual'"
          :collapsed="section.collapsed"
          @dragstart="onGroupDragStart(section.key, $event)"
          @toggle="section.toggle"
          @create="section.create?.()"
        />

        <div
          v-if="section.sessions.length > 0 || section.more"
          class="session-list-group"
          :class="{ 'is-open': !section.collapsed }"
        >
          <div class="group-body">
            <SessionItem
              v-for="session in section.sessions"
              :key="session.id"
              v-bind="itemBind(session)"
              @navigate="emit('navigate', session.cwd)"
              @toggle-pinned="togglePinned"
              @rename="renameSession"
              @delete="deleteSession"
            />

            <button
              v-if="section.more"
              class="more-button"
              type="button"
              @click="section.toggleReveal"
            >
              {{ section.revealed ? "收起" : "显示更多" }}
            </button>
          </div>
        </div>
      </li>
    </ul>

    <span v-else-if="groups.length">暂无会话</span>
  </nav>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue"
import { useTimestamp } from "@vueuse/core"
import { ChevronDown, ChevronRight } from "@lucide/vue"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionsHead from "@features/session-nav/components/SessionsHead.vue"
import { useGroupReorder } from "@features/session-nav/hooks/use-group-reorder.js"
import { toSidebarSession } from "@features/session-nav/lib/session-list.js"
import type { SidebarRow, SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"

const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  createInDir: [canonicalPath: string]
}>()
const {
  groups,
  cardFootById,
  view,
  sort,
  setView,
  setSort,
  reorderGroups,
  toggleGroupReveal,
  toggleGroup,
  setGroupsCollapsed,
  rowsFor,
  pinnedIds,
  pinnedSessions,
  togglePinned,
  connected,
  highlightedSessionId,
  renameSession,
  deleteSession,
} = useNav()
const now = useTimestamp({ interval: 60_000 })
const collapsedSections = reactive({ pinned: false })
const rows = rowsFor(false)
const showList = computed(() => rows.value.some((row) => row.kind !== "more"))
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)
const { dropLine, onGroupDragStart, onGroupDragOver, onGroupDrop, clearGroupDrag } =
  useGroupReorder(groupRows, reorderGroups)
const updatedSessions = computed(() =>
  rows.value.flatMap((row) => (row.kind === "session" ? [row.session] : [])),
)
const updatedMore = computed(() => rows.value.find((row) => row.kind === "more"))
const pinnedRows = computed(() => pinnedSessions.value.map(toSidebarSession))
const listSections = computed(() =>
  groupRows.value.map((row) => ({
    key: row.key,
    name: workspaceName(row.canonicalPath),
    kind: "directory" as const,
    collapsed: row.collapsed,
    open: !row.collapsed && (row.sessions.length > 0 || row.more),
    sessions: row.sessions,
    more: row.more,
    revealed: row.revealed,
    toggleReveal: () => toggleGroupReveal(row.key),
    toggle: () => toggleGroup(row.canonicalPath),
    create: () => emit("createInDir", row.canonicalPath),
  })),
)
const allCollapsed = computed(
  () => groupRows.value.length > 0 && groupRows.value.every((row) => row.collapsed),
)

function toggleAllGroups() {
  setGroupsCollapsed(!allCollapsed.value)
}

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function itemBind(session: SidebarSession, extra?: { pinned?: boolean; showPath?: boolean }) {
  return {
    session,
    active: session.id === highlightedSessionId.value,
    pinned: extra?.pinned ?? pinnedIds.value.has(session.id),
    showPath: extra?.showPath ?? false,
    state: sessionState(session.id),
    now: now.value,
  }
}

function groupClass(key: string, open: boolean) {
  return {
    "row-group": true,
    "is-open": open,
    "is-manual": sort.value === "manual",
    "drop-before": dropLine.value?.key === key && dropLine.value.place === "before",
    "drop-after": dropLine.value?.key === key && dropLine.value.place === "after",
  }
}
</script>

<style scoped>
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-list {
  position: relative;
  gap: var(--spacing-xxs);
}

.nav-body::-webkit-scrollbar {
  display: none;
}

.session-list ul {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}

.nav-section,
.row-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-group.is-manual .group-head {
  cursor: grab;
}

.row-group.drop-before,
.row-group.drop-after {
  position: relative;
}

.row-group.drop-before::before,
.row-group.drop-after::after {
  content: "";
  position: absolute;
  z-index: 1;
  right: var(--spacing-xs);
  left: var(--spacing-xs);
  height: 2px;
  border-radius: var(--radius-full);
  background: var(--primary);
  pointer-events: none;
}

.row-group.drop-before::before {
  top: calc(var(--spacing-xs) / -2);
}

.row-group.drop-after::after {
  bottom: calc(var(--spacing-xs) / -2);
}

.section-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: var(--size-icon-button);
  padding-inline: var(--spacing-xs);
}

.section-label-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-bold);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-fold {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon);
  height: var(--size-icon);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}

.section-fold:hover,
.section-fold:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

@media (hover: hover) {
  .section-fold {
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-out);
  }

  .section-label:is(:hover, :focus-within) .section-fold,
  .section-fold:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-block-start: var(--spacing-xxs);
}

.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--size-scroll-control);
  padding-inline: calc(var(--spacing-xs) + var(--size-icon) + var(--spacing-xxs)) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
}

.more-button:hover,
.more-button:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}
</style>
