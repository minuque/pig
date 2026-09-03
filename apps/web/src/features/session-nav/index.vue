<template>
  <div class="session-nav" :class="{ collapsed }">
    <div class="titlebar-drag"></div>

    <div class="logo-row">
      <RouterLink v-if="!collapsed" to="/" class="logo-mark">
        <img src="/logo.png" alt="" width="22" height="22" />
      </RouterLink>
      <button class="collapse-toggle" type="button" title="折叠侧边栏" @click="emit('toggle')">
        <PanelLeft class="size-icon" />
      </button>
    </div>

    <button
      v-if="collapsed"
      class="rail-action press-scale"
      type="button"
      title="搜索"
      @click="searchOpen = true"
    >
      <Search class="size-icon" />
    </button>

    <div v-show="!collapsed" class="nav-main">
      <NavToolbar @search="searchOpen = true" />

      <div class="nav-body">
        <nav class="session-list">
          <section v-if="pinnedRows.length" class="nav-section pinned-section">
            <GroupHead
              name="置顶"
              kind="pinned"
              :count="pinnedRows.length"
              :collapsed="collapsedSections.pinned"
              @toggle="collapsedSections.pinned = !collapsedSections.pinned"
            />
            <div class="session-list-group" :class="{ 'is-open': !collapsedSections.pinned }">
              <div class="group-body">
                <SessionItem
                  v-for="session in pinnedRows"
                  :key="session.id"
                  :session="session"
                  :active="session.id === activeSessionId"
                  :pinned="true"
                  :state="sessionState(session.id)"
                  :now="now"
                  :model-provider="modelProvider(session.id)"
                  @navigate="onSessionNavigate(session.cwd)"
                  @toggle-pinned="togglePinned"
                  @rename="renameSession"
                  @delete="deleteSession"
                />
              </div>
            </div>
          </section>

          <ul v-if="showList && grouping === 'project'">
            <li v-for="row in groupRows" :key="row.key" class="row-group">
              <GroupHead
                :name="workspaceName(row.canonicalPath)"
                kind="directory"
                :count="row.sessions.length"
                :collapsed="row.collapsed"
                @toggle="toggleGroup(row.canonicalPath)"
              />
              <div
                v-if="row.sessions.length > 0 || row.more"
                class="session-list-group"
                :class="{ 'is-open': !row.collapsed }"
              >
                <TransitionGroup name="list-reveal" tag="div" class="group-body">
                  <SessionItem
                    v-for="session in row.sessions"
                    :key="session.id"
                    :session="session"
                    :active="session.id === activeSessionId"
                    :pinned="pinnedIds.has(session.id)"
                    :state="sessionState(session.id)"
                    :now="now"
                    :model-provider="modelProvider(session.id)"
                    @navigate="onSessionNavigate(session.cwd)"
                    @toggle-pinned="togglePinned"
                    @rename="renameSession"
                    @delete="deleteSession"
                  />
                  <button
                    v-if="row.more"
                    :key="`${row.key}-more`"
                    class="more-button"
                    type="button"
                    @click="bumpGroup(row.key)"
                  >
                    显示更多
                  </button>
                </TransitionGroup>
              </div>
            </li>
          </ul>

          <ul v-else-if="showList" class="time-sections">
            <li v-for="(section, index) in timeSections" :key="section.key" class="time-section">
              <GroupHead
                :name="section.name"
                kind="time"
                :count="section.sessions.length"
                :collapsed="collapsedSections[section.key]"
                @toggle="toggleTimeSection(section.key)"
              />
              <div
                class="session-list-group"
                :class="{ 'is-open': !collapsedSections[section.key] }"
              >
                <TransitionGroup name="list-reveal" tag="div" class="group-body">
                  <SessionItem
                    v-for="session in section.sessions"
                    :key="session.id"
                    :session="session"
                    :active="session.id === activeSessionId"
                    :pinned="pinnedIds.has(session.id)"
                    :state="sessionState(session.id)"
                    :now="now"
                    :model-provider="modelProvider(session.id)"
                    @navigate="onSessionNavigate(session.cwd)"
                    @toggle-pinned="togglePinned"
                    @rename="renameSession"
                    @delete="deleteSession"
                  />
                  <button
                    v-if="hasMore && index === timeSections.length - 1"
                    :key="`${section.key}-more`"
                    class="more-button"
                    type="button"
                    @click="bumpGroup('updated')"
                  >
                    显示更多
                  </button>
                </TransitionGroup>
              </div>
              <div v-if="collapsedSections[section.key]" class="collapsed-preview">
                <SessionItem
                  v-if="section.sessions[0]"
                  :session="section.sessions[0]"
                  :active="section.sessions[0].id === activeSessionId"
                  :pinned="pinnedIds.has(section.sessions[0].id)"
                  :state="sessionState(section.sessions[0].id)"
                  :now="now"
                  :model-provider="modelProvider(section.sessions[0].id)"
                  @navigate="onSessionNavigate(section.sessions[0].cwd)"
                  @toggle-pinned="togglePinned"
                  @rename="renameSession"
                  @delete="deleteSession"
                />
              </div>
            </li>
          </ul>

          <div v-else class="empty-state">
            <template v-if="groups.length === 0">
              <span>还没有工作目录</span>
              <button class="empty-add" type="button" @click="addWorkspace()">
                <Plus :size="12" />
                添加本地目录
              </button>
            </template>
            <span v-else>暂无会话</span>
          </div>
        </nav>
      </div>
    </div>

    <NavFooter
      :grouping="grouping"
      :adding-workspace="addingWorkspace"
      :collapsed="collapsed"
      @add-workspace="addWorkspace"
      @set-grouping="setGrouping"
      @settings="openSettings"
    />
    <SessionSearch v-model:open="searchOpen" @navigate="onSessionNavigate" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue"
import { useEventListener, useTimestamp } from "@vueuse/core"
import { RouterLink } from "vue-router"
import { PanelLeft, Plus, Search } from "@lucide/vue"
import { notify } from "@components/ui/alert/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionSearch from "@features/session-nav/components/SessionSearch.vue"
import { sidebarTimeSections, toSidebarSession } from "@features/session-nav/lib/session-list.js"
import { useSettings } from "@features/settings/index.js"
import type { SidebarRow, SidebarSessionState } from "@features/session-nav/type.js"

defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  navigate: [canonicalPath: string]
  toggle: []
}>()

const {
  groups,
  cardFootById,
  grouping,
  setGrouping,
  bumpGroup,
  toggleGroup,
  rowsFor,
  pinnedIds,
  pinnedSessions,
  togglePinned,
  addingWorkspace,
  activeSessionId,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()
const { openSettings } = useSettings()

const searchOpen = shallowRef(false)
const now = useTimestamp({ interval: 60_000 })
const collapsedSections = reactive({ pinned: false, today: false, recent: false })
const rows = rowsFor(false)
const showList = computed(() => rows.value.some((row) => row.kind !== "more"))
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)
const updatedSessions = computed(() =>
  rows.value.flatMap((row) => (row.kind === "session" ? [row.session] : [])),
)
const timeSections = computed(() => sidebarTimeSections(updatedSessions.value, now.value))
const hasMore = computed(() => rows.value.some((row) => row.kind === "more"))
const pinnedRows = computed(() => pinnedSessions.value.map(toSidebarSession))

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return
  event.preventDefault()
  searchOpen.value = true
})

watch(workspaceError, (message) => {
  const text = message.trim()
  if (text) notify.error(text)
})

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function modelProvider(id: string): string {
  return cardFootById.value.get(id)?.modelProvider ?? ""
}

function toggleTimeSection(key: "today" | "recent"): void {
  collapsedSections[key] = !collapsedSections[key]
}

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}
</script>

<style scoped>
.session-nav {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  user-select: none;
}
.session-nav.collapsed {
  align-items: center;
}
.titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform] .titlebar-drag {
  display: block;
}
html[data-pig-desktop-platform="win32"] .titlebar-drag {
  display: none;
}
html[data-pig-desktop-platform="darwin"] .session-nav.collapsed .titlebar-drag {
  height: 32px;
}
html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}
html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: 10px;
  padding-inline-start: 2px;
}
html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: 32px;
}
html[data-pig-desktop-platform="darwin"] .session-nav.collapsed {
  padding-top: 48px;
}
html[data-pig-desktop-platform] .session-nav :is(button, a, input) {
  -webkit-app-region: no-drag;
}
.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
  padding-inline: 2px;
}
.logo-mark,
.collapse-toggle,
.rail-action {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.logo-mark {
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
}
.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
:is(.logo-mark, .collapse-toggle, .rail-action):hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
.nav-main,
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.nav-main {
  gap: var(--spacing-xxs);
}
.nav-body {
  overflow: auto;
  scrollbar-gutter: stable;
}
.session-list {
  padding-inline-end: var(--spacing-xxs);
}
.session-list ul {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.session-list li {
  padding-block-end: var(--spacing-xxs);
}
.nav-section,
.row-group,
.time-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pinned-section {
  position: sticky;
  z-index: 2;
  top: 0;
  margin-block-end: var(--spacing-sm);
  padding-block-end: var(--spacing-xxs);
  background: var(--sidebar);
}
.group-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-block-start: var(--spacing-xxs);
}
.time-section {
  position: relative;
  margin-block-end: var(--spacing-xs);
}
.collapsed-preview {
  position: relative;
  z-index: 1;
  margin: var(--spacing-xxs) var(--spacing-xxs) var(--spacing-xs);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.collapsed-preview::before,
.collapsed-preview::after {
  position: absolute;
  z-index: -1;
  inset-inline: var(--spacing-xs);
  inset-block: 0;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: var(--surface);
  content: "";
  transform: translateY(5px);
}
.collapsed-preview::after {
  inset-inline: var(--spacing-sm);
  transform: translateY(9px);
  opacity: 0.55;
}
.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: 30px;
  padding-inline: var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
}
.more-button:hover,
.more-button:focus-visible {
  color: var(--ink);
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-lg) var(--spacing-xs);
  color: var(--ink-faint);
  font-size: var(--text-caption);
  text-align: center;
}
.empty-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-xxs) 10px;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
}
.empty-add:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
.session-nav.collapsed .logo-row {
  width: var(--size-nav-rail);
  justify-content: center;
  padding-inline: 0;
}
</style>
