<template>
  <div class="session-nav" :class="{ collapsed }">
    <!-- 仅桌面壳可见；win32 用系统 caption，不画侧栏拖条 -->
    <div class="titlebar-drag"></div>

    <div class="logo-row">
      <RouterLink v-if="!collapsed" to="/" class="logo-mark">
        <img src="/logo.png" alt="" width="22" height="22" />
      </RouterLink>
      <button class="icon-button collapse-toggle" type="button" @click="emit('toggle')">
        <PanelLeft class="size-icon" />
      </button>
    </div>

    <template v-if="collapsed">
      <button
        class="icon-button rail-action press-scale"
        type="button"
        :disabled="Boolean(creating)"
        title="新会话"
        @click="onNewSession()"
      >
        <SquarePen class="size-icon" />
      </button>
      <button
        class="icon-button rail-action press-scale"
        type="button"
        title="搜索"
        @click="searchOpen = true"
      >
        <Search class="size-icon" />
      </button>
    </template>

    <div v-show="!collapsed" class="nav-main">
      <NavToolbar @new-session="onNewSession" @search="searchOpen = true" />

      <div class="nav-body">
        <nav class="session-list">
          <ul v-if="showList && grouping === 'project'">
            <li
              v-for="row in groupRows"
              :key="row.key"
              class="row-group"
              :class="{ 'is-open': !row.collapsed && (row.sessions.length > 0 || row.more) }"
            >
              <GroupHead
                :name="workspaceName(row.canonicalPath)"
                :collapsed="row.collapsed"
                :creating="Boolean(creating)"
                @toggle="toggleGroup(row.canonicalPath)"
                @create="createSession(row.canonicalPath)"
              />
              <div
                v-if="row.sessions.length > 0 || row.more"
                class="fold-height"
                :class="{ 'is-open': !row.collapsed }"
              >
                <TransitionGroup name="list-reveal" tag="div" class="group-body">
                  <SessionItem
                    v-for="session in row.sessions"
                    :key="session.id"
                    :session="session"
                    :workspace-title="session.cwd ? workspaceName(session.cwd) : ''"
                    :active="session.id === activeSessionId"
                    :running="activeSessionRunning && session.id === activeSessionId"
                    grouping="project"
                    :now="now"
                    :message-count="cardFootById.get(session.id)?.messageCount ?? null"
                    :model-provider="cardFootById.get(session.id)?.modelProvider ?? ''"
                    @navigate="onSessionNavigate(session.cwd)"
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
          <TransitionGroup v-else-if="showList" name="list-reveal" tag="ul">
            <li v-for="row in rows" :key="row.key" :class="`row-${row.kind}`">
              <SessionItem
                v-if="row.kind === 'session'"
                :session="row.session"
                :workspace-title="row.session.cwd ? workspaceName(row.session.cwd) : ''"
                :active="row.session.id === activeSessionId"
                :running="activeSessionRunning && row.session.id === activeSessionId"
                :grouping="grouping"
                :now="now"
                :message-count="cardFootById.get(row.session.id)?.messageCount ?? null"
                :model-provider="cardFootById.get(row.session.id)?.modelProvider ?? ''"
                @navigate="onSessionNavigate(row.session.cwd)"
                @rename="renameSession"
                @delete="deleteSession"
              />
              <button
                v-else-if="row.kind === 'more'"
                class="more-button"
                type="button"
                @click="bumpGroup(row.groupKey)"
              >
                显示更多
              </button>
            </li>
          </TransitionGroup>
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
    <button
      class="icon-button settings-gear press-scale"
      type="button"
      title="设置"
      @click="openSettings()"
    >
      <Settings class="size-icon" />
    </button>
    <SessionSearch v-model:open="searchOpen" @navigate="onSessionNavigate" />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useTimestamp } from "@vueuse/core"
import { RouterLink, useRouter } from "vue-router"
import { PanelLeft, Plus, Search, Settings, SquarePen } from "lucide-vue-next"
import { notify } from "@components/ui/alert/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionSearch from "@features/session-nav/components/SessionSearch.vue"
import { useSettings } from "@features/settings/index.js"
import type { SidebarRow } from "@features/session-nav/lib/session-list.js"

defineProps<{
  collapsed?: boolean
}>()

const emit = defineEmits<{
  navigate: [canonicalPath: string]
  toggle: []
}>()

const router = useRouter()
const {
  groups,
  cardFootById,
  grouping,
  bumpGroup,
  toggleGroup,
  rowsFor,
  activeSessionId,
  activeSessionRunning,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()
const { creating, createSession } = useSession()
const { openSettings } = useSettings()

const searchOpen = shallowRef(false)
const now = useTimestamp({ interval: 60_000 })
const rows = rowsFor(false)
const showList = computed(() => rows.value.length > 0)
const groupRows = computed(() =>
  rows.value.filter((row): row is Extract<SidebarRow, { kind: "group" }> => row.kind === "group"),
)

watch(workspaceError, (message) => {
  const text = message.trim()
  if (text) notify.error(text)
})

function onNewSession() {
  void router.push("/")
}

function onSessionNavigate(cwd: string | undefined) {
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
  top: 0;
  left: 0;
  right: 0;
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
  padding-left: 2px;
}
html[data-pig-desktop-platform="darwin"] .session-nav {
  padding-top: 32px;
}
html[data-pig-desktop-platform="darwin"] .session-nav.collapsed {
  padding-top: 48px;
}
html[data-pig-desktop-platform] .session-nav button,
html[data-pig-desktop-platform] .session-nav a,
html[data-pig-desktop-platform] .session-nav input {
  -webkit-app-region: no-drag;
}

.logo-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--size-nav-rail);
  padding-inline: 2px;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}
.logo-mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-nav-rail);
  min-height: var(--size-nav-rail);
  border-radius: var(--radius-md);
}
.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.logo-mark:hover {
  background: var(--hover-quiet);
}
.settings-gear {
  margin-top: auto;
}
.collapse-toggle,
.rail-action,
.settings-gear {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: none;
  width: var(--size-icon-button);
  min-height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.rail-action,
.settings-gear {
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    scale var(--duration-fast) var(--ease-out);
}
.collapse-toggle:hover,
.rail-action:hover:not(:disabled),
.settings-gear:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}
.rail-action:disabled {
  opacity: 0.45;
}

.nav-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
}
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}

.session-list {
  padding-inline-end: var(--spacing-xxs);
}
.session-list ul {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}
.session-list li {
  padding-bottom: var(--spacing-xxs);
}
.row-session {
  padding-inline-end: var(--spacing-xxs);
}
.row-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  padding: 0;
  padding-bottom: var(--spacing-xxs);
  border-radius: var(--radius-lg);
  background-color: transparent;
  box-shadow: none;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out),
    padding var(--duration-fast) var(--ease-out),
    margin-bottom var(--duration-fast) var(--ease-out);
}
.row-group.is-open {
  margin-bottom: var(--spacing-xs);
  padding: var(--spacing-xxs);
  border: 1px solid var(--color-border);
  background-color: var(--nav-well);
  box-shadow: var(--shadow-group);
  transition-duration: var(--duration-slow);
}
.group-body {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xxs);
  padding-top: var(--spacing-xxs);
}
.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 var(--spacing-xs);
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
@media (prefers-reduced-motion: reduce) {
  .rail-action,
  .settings-gear,
  .row-group,
  .row-group.is-open {
    transition: none;
  }
}
.session-nav.collapsed .logo-row {
  overflow: visible;
  scrollbar-gutter: auto;
  width: var(--size-nav-rail);
  justify-content: center;
  padding-inline: 0;
}
</style>
