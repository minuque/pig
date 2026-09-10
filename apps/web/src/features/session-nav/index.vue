<template>
  <div class="session-nav">
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="nav-card">
      <div class="nav-inset">
        <div class="logo-row">
          <RouterLink to="/" class="logo-mark">
            <img src="/pwa-icon-192.png" alt="" width="22" height="22" />
          </RouterLink>
          <button class="collapse-toggle" type="button" title="折叠侧边栏" @click="emit('toggle')">
            <PanelLeft class="size-icon" />
          </button>
        </div>

        <div class="nav-main">
          <NavToolbar @search="searchOpen = true" />

          <div class="nav-body">
            <nav class="session-list">
              <section
                v-if="pinnedRows.length"
                class="nav-section pinned-section"
                :class="{ 'is-open': !collapsedSections.pinned }"
              >
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
                      :active="session.id === highlightedSessionId"
                      :pinned="true"
                      :state="sessionState(session.id)"
                      :now="now"
                      @navigate="onSessionNavigate(session.cwd)"
                      @toggle-pinned="togglePinned"
                      @rename="renameSession"
                      @delete="deleteSession"
                    />
                  </div>
                </div>
              </section>

              <Transition :name="groupSlide">
                <ul
                  v-if="showList"
                  :key="grouping"
                  :class="{ 'time-sections': grouping === 'updated' }"
                >
                  <li
                    v-for="section in listSections"
                    :key="section.key"
                    :class="[section.rowClass, { 'is-open': section.open }]"
                  >
                    <GroupHead
                      :name="section.name"
                      :kind="section.kind"
                      :count="section.count"
                      :collapsed="section.collapsed"
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
                          :session="session"
                          :active="session.id === highlightedSessionId"
                          :pinned="pinnedIds.has(session.id)"
                          :state="sessionState(session.id)"
                          :now="now"
                          @navigate="onSessionNavigate(session.cwd)"
                          @toggle-pinned="togglePinned"
                          @rename="renameSession"
                          @delete="deleteSession"
                        />
                        <button
                          v-if="section.more"
                          class="more-button"
                          type="button"
                          @click="section.bump"
                        >
                          显示更多
                        </button>
                      </div>
                    </div>
                  </li>
                </ul>

                <span v-else-if="groups.length" key="empty">暂无会话</span>
              </Transition>
            </nav>
          </div>

          <p v-if="connected && !groups.length" class="add-guide">
            点击添加工作目录
            <ArrowDown class="size-icon motion-nudge" />
          </p>
        </div>
      </div>

      <NavFooter
        :adding-workspace="addingWorkspace"
        :hint-add="connected && !groups.length"
        @add-workspace="addWorkspace"
        @settings="openSettings"
      />
      <NavShift :grouping="grouping" @set-grouping="setGrouping" />
    </div>
    <SessionSearch v-model:open="searchOpen" @navigate="onSessionNavigate" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, shallowRef, watch } from "vue"
import { useEventListener, useTimestamp } from "@vueuse/core"
import { RouterLink, useRouter } from "vue-router"
import { ArrowDown, PanelLeft } from "@lucide/vue"
import { notifyError } from "@components/ui/alert/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import NavFooter from "@features/session-nav/components/NavFooter.vue"
import NavShift from "@features/session-nav/components/NavShift.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionSearch from "@features/session-nav/components/SessionSearch.vue"
import { sidebarTimeSections, toSidebarSession } from "@features/session-nav/lib/session-list.js"
import { useSettings } from "@features/settings/index.js"
import type { SidebarRow, SidebarSessionState } from "@features/session-nav/type.js"

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
  connected,
  highlightedSessionId,
  cancelPendingOpen,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()

const { openSettings } = useSettings()
const router = useRouter()

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
const groupSlide = computed(() => (grouping.value === "updated" ? "slide-next" : "slide-prev"))
const listSections = computed(() => {
  if (grouping.value === "project") {
    return groupRows.value.map((row) => ({
      key: row.key,
      rowClass: "row-group",
      name: workspaceName(row.canonicalPath),
      kind: "directory" as const,
      count: row.sessions.length,
      collapsed: row.collapsed,
      open: !row.collapsed && (row.sessions.length > 0 || row.more),
      sessions: row.sessions,
      more: row.more,
      bump: () => bumpGroup(row.key),
      toggle: () => toggleGroup(row.canonicalPath),
      create: () => onCreateInDir(row.canonicalPath),
    }))
  }
  return timeSections.value.map((section, index) => ({
    key: section.key,
    rowClass: "time-section",
    name: section.name,
    kind: "time" as const,
    count: section.sessions.length,
    collapsed: collapsedSections[section.key],
    open: !collapsedSections[section.key],
    sessions: section.sessions,
    more: hasMore.value && index === timeSections.value.length - 1,
    bump: () => bumpGroup("updated"),
    toggle: () => toggleTimeSection(section.key),
    create: undefined as (() => void) | undefined,
  }))
})

useEventListener(window, "keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return
  event.preventDefault()
  searchOpen.value = true
})

watch(workspaceError, (message) => {
  const text = message.trim()
  if (text) notifyError(text)
})

function sessionState(id: string): SidebarSessionState | undefined {
  return cardFootById.value.get(id)?.state
}

function toggleTimeSection(key: "today" | "recent"): void {
  collapsedSections[key] = !collapsedSections[key]
}

function onSessionNavigate(cwd: string | undefined): void {
  if (cwd) emit("navigate", cwd)
}

function onCreateInDir(canonicalPath: string): void {
  cancelPendingOpen()
  emit("navigate", canonicalPath)
  void router.push("/")
}
</script>

<style scoped>
.session-nav {
  --nav-inline: var(--spacing-xs);
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--nav-shell-pad);
  overflow: hidden;
  user-select: none;
}

.nav-card {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--sidebar);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
}

.nav-inset {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  padding-inline: var(--nav-inline);
}

.session-nav > .titlebar-drag {
  display: none;
  position: absolute;
  inset: 0 0 auto;
  height: var(--titlebar-inset);
  -webkit-app-region: drag;
  app-region: drag;
}
html[data-pig-desktop-platform] .session-nav > .titlebar-drag {
  display: block;
}
html[data-pig-desktop-platform="win32"] .session-nav > .titlebar-drag {
  display: none;
}

html[data-pig-desktop-platform] .session-nav {
  padding-top: calc(6px + var(--titlebar-inset));
}
html[data-pig-desktop-platform="win32"] .session-nav {
  padding-top: var(--spacing-xs);
}
html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: 32px;
}

html[data-pig-desktop-platform] .logo-row {
  background: var(--sidebar);
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .logo-row :is(button, a) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
}
html[data-pig-desktop-platform="win32"] .logo-row {
  min-height: var(--titlebar-inset);
}

.logo-mark,
.collapse-toggle {
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

:is(.logo-mark, .collapse-toggle):hover {
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
  gap: var(--spacing-xs);
}

.nav-body {
  overflow: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.session-list {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.nav-body::-webkit-scrollbar {
  display: none;
}

.session-list ul {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
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
  background: var(--sidebar);
}

.group-body {
  --tree-y: calc(var(--size-nav-rail) / 2);
  --tree-r: var(--radius-sm);
  --tree-elbow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='19' fill='none' shape-rendering='geometricPrecision'%3E%3Cpath d='M.5 0V12Q.5 18 6.5 18H15.5' stroke='%23000' stroke-width='1'/%3E%3C/svg%3E");
  position: relative;
  display: flex;
  flex-direction: column;
  padding-inline-start: calc(var(--spacing-xs) + var(--size-icon) + var(--spacing-xs));
}
.group-body > * {
  position: relative;
}
.group-body > *:not(:last-child) {
  padding-block-end: var(--spacing-xxs);
}
.group-body > *::before,
.group-body > *:not(:last-child)::after {
  box-sizing: border-box;
  position: absolute;
  inset-inline-start: calc(-1 * var(--spacing-md));
  pointer-events: none;
  content: "";
}
.group-body > *::before {
  top: 0;
  width: var(--spacing-md);
  height: calc(var(--tree-y) + 1px);
  background: var(--ink-muted);
  -webkit-mask: var(--tree-elbow) no-repeat;
  mask: var(--tree-elbow) no-repeat;
}
.group-body > *:not(:last-child)::after {
  top: calc(var(--tree-y) - var(--tree-r));
  bottom: 0;
  width: var(--border-width);
  background: var(--ink-muted);
}

.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: 30px;
  padding-inline: var(--spacing-xxs) var(--spacing-xs);
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

.add-guide {
  display: flex;
  flex: none;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xxs);
  margin: 0;
  padding-block: var(--spacing-xxs);
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
}

.add-guide .motion-nudge {
  margin-inline-start: calc((var(--size-icon-button) - var(--size-icon)) / 2);
}

@media (max-width: 900px) {
  .session-nav {
    --nav-inline: var(--spacing-md);
    padding: var(--spacing-md);
  }
}
</style>
