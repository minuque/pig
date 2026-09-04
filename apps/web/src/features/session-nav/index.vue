<template>
  <div class="session-nav" :class="{ collapsed }">
    <div class="titlebar-drag"></div>

    <div class="nav-inset">
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
            <!-- 置顶会话 -->
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

            <Transition :name="groupSlide">
              <ul v-if="showList && grouping === 'project'" key="project">
                <li
                  v-for="row in groupRows"
                  :key="row.key"
                  class="row-group"
                  :class="{ 'is-open': !row.collapsed && (row.sessions.length > 0 || row.more) }"
                >
                  <GroupHead
                    :name="workspaceName(row.canonicalPath)"
                    kind="directory"
                    :count="row.sessions.length"
                    :collapsed="row.collapsed"
                    @toggle="toggleGroup(row.canonicalPath)"
                    @create="onCreateInDir(row.canonicalPath)"
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

              <ul v-else-if="showList" key="updated" class="time-sections">
                <li
                  v-for="(section, index) in timeSections"
                  :key="section.key"
                  class="time-section"
                  :class="{ 'is-open': !collapsedSections[section.key] }"
                >
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
                </li>
              </ul>

              <span v-else-if="groups.length" key="empty">暂无会话</span>
            </Transition>
          </nav>
        </div>
        <p v-if="!groups.length" class="add-guide">
          点击添加工作目录
          <ArrowDown class="size-icon motion-nudge" />
        </p>
      </div>
    </div>

    <NavFooter
      :grouping="grouping"
      :adding-workspace="addingWorkspace"
      :collapsed="collapsed"
      :hint-add="!groups.length"
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
import { RouterLink, useRouter } from "vue-router"
import { ArrowDown, PanelLeft, Search } from "@lucide/vue"
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

function onCreateInDir(canonicalPath: string): void {
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
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  padding-block-start: var(--spacing-xs);
  overflow: hidden;
  user-select: none;
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
.session-nav.collapsed .nav-inset {
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
  padding-top: 0;
  padding-inline-start: 2px;
}
html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: 32px;
}
html[data-pig-desktop-platform="darwin"] .session-nav.collapsed {
  padding-top: 48px;
}
html[data-pig-desktop-platform] .logo-row {
  -webkit-app-region: drag;
}
html[data-pig-desktop-platform] .logo-row :is(button, a) {
  -webkit-app-region: no-drag;
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
  overflow-x: hidden;
  /* 原生滚动条占宽会挤内容，与上下工具栏错位；隐藏后内容恒宽，滚动仍可用 */
  scrollbar-width: none;
}
.session-list {
  position: relative;
}
.nav-body::-webkit-scrollbar {
  display: none;
}
.session-list ul {
  display: flex;
  flex-direction: column;
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
  margin-block-end: 0;
  padding: 0;
  padding-block-end: var(--spacing-xxs);
  border-radius: var(--radius-lg);
  background-color: transparent;
  box-shadow: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    padding var(--duration-fast) var(--ease-out),
    margin-block-end var(--duration-fast) var(--ease-out);
}
.nav-section.is-open,
.row-group.is-open,
.time-section.is-open {
  margin-block-end: var(--spacing-xs);
  padding: var(--spacing-xxs);
  border: var(--border-width) solid var(--color-border);
  background-color: var(--surface);
  box-shadow: var(--shadow-group);
  transition-duration: var(--duration-slow);
}
.pinned-section {
  position: sticky;
  z-index: 2;
  top: 0;
  background: var(--sidebar);
}
.group-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-block-start: var(--spacing-xxs);
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
@media (prefers-reduced-motion: reduce) {
  .nav-section,
  .row-group,
  .time-section,
  .nav-section.is-open,
  .row-group.is-open,
  .time-section.is-open {
    transition: none;
  }
}
.session-nav.collapsed .logo-row {
  width: var(--size-nav-rail);
  justify-content: center;
}
@media (max-width: 900px) {
  .session-nav {
    --nav-inline: var(--spacing-md);
    padding-block-start: var(--spacing-md);
  }
}
</style>
