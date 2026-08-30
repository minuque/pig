<template>
  <div class="session-nav" :class="{ collapsed }">
    <!-- 仅桌面壳可见；win32 用系统 caption，不画侧栏拖条 -->
    <div class="titlebar-drag"></div>

    <div class="logo-row">
      <RouterLink v-if="!collapsed" to="/" class="logo-mark">
        <img src="/logo.png" alt="" width="22" height="22" />
      </RouterLink>
      <button class="icon-button collapse-toggle" type="button" @click="emit('toggle')">
        <PanelLeft :size="16" />
      </button>
    </div>

    <template v-if="collapsed">
      <button
        class="icon-button rail-action"
        type="button"
        :disabled="Boolean(creating)"
        title="新会话"
        @click="onNewSession()"
      >
        <SquarePen :size="16" />
      </button>
    </template>

    <div v-show="!collapsed" class="nav-main">
      <NavToolbar v-model:search-query="searchQuery" @new-session="onNewSession" />

      <div v-bind="containerProps" class="nav-body">
        <nav class="session-list">
          <ul v-if="showList" v-bind="wrapperProps">
            <li v-for="item in list" :key="item.data.key" :class="`row-${item.data.kind}`">
              <GroupHead
                v-if="item.data.kind === 'group'"
                :name="workspaceName(item.data.canonicalPath)"
                :collapsed="item.data.collapsed"
                :creating="Boolean(creating)"
                @toggle="toggleGroup(item.data.canonicalPath)"
                @create="createSession(item.data.canonicalPath)"
              />
              <SessionItem
                v-else-if="item.data.kind === 'session'"
                :session="item.data.session"
                :workspace-title="item.data.session.cwd ? workspaceName(item.data.session.cwd) : ''"
                :active="item.data.session.id === activeSessionId"
                :running="activeSessionRunning && item.data.session.id === activeSessionId"
                :grouping="grouping"
                :now="now"
                :message-count="cardFootById.get(item.data.session.id)?.messageCount ?? null"
                :model-provider="cardFootById.get(item.data.session.id)?.modelProvider ?? ''"
                @navigate="onSessionNavigate(item.data.session.cwd)"
                @rename="renameSession"
                @delete="deleteSession"
              />
              <button
                v-else
                class="more-button"
                type="button"
                @click="bumpGroup(item.data.groupKey)"
              >
                显示更多
              </button>
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
            <span v-else-if="searching">没有匹配的会话</span>
            <span v-else>暂无会话</span>
          </div>
        </nav>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch } from "vue"
import { useTimestamp, useVirtualList } from "@vueuse/core"
import { RouterLink, useRouter } from "vue-router"
import { PanelLeft, Plus, SquarePen } from "lucide-vue-next"
import { notify } from "@components/ui/alert/index.js"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import GroupHead from "@features/session-nav/components/GroupHead.vue"
import NavToolbar from "@features/session-nav/components/NavToolbar.vue"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { filterSessionsForSearch } from "@features/session-nav/lib/session-list.js"

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
  listedSessions,
  cardFootById,
  grouping,
  bumpGroup,
  toggleGroup,
  rowsFor,
  activeWorkspaceId,
  activeSessionId,
  activeSessionRunning,
  lastCwd,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()
const { creating, createSession } = useSession()

const searchQuery = shallowRef("")
const now = useTimestamp({ interval: 60_000 })
const searching = computed(() => searchQuery.value.trim() !== "")
const visibleSessions = computed(() =>
  filterSessionsForSearch(listedSessions.value, searchQuery.value),
)
const rows = rowsFor(searching, visibleSessions)
const showList = computed(() =>
  searching.value ? rows.value.some((row) => row.kind === "session") : rows.value.length > 0,
)

const GROUP_ROW_PX = 36
const SESSION_ROW_PX = 56
const MORE_ROW_PX = 34
const { list, containerProps, wrapperProps } = useVirtualList(rows, {
  itemHeight: (index) => {
    const row = rows.value[index]
    if (row?.kind === "group") return GROUP_ROW_PX
    if (row?.kind === "more") return MORE_ROW_PX
    return SESSION_ROW_PX
  },
})

watch(workspaceError, (message) => {
  const text = message.trim()
  if (text) notify.error(text)
})

/** 打开中会话 cwd → lastCwd；都没有则不在侧栏创建。 */
const newSessionPath = computed(() => {
  const open = activeWorkspaceId.value
  if (open) return canonicalizeWorkspacePath(open)
  return lastCwd.value
})

function onNewSession() {
  const path = newSessionPath.value
  if (!path) {
    void router.push("/")
    return
  }
  void createSession(path)
}

function onSessionNavigate(cwd: string | undefined) {
  if (cwd) emit("navigate", cwd)
}
</script>

<style scoped>
.session-nav {
  --nav-row: 28px;
  --nav-rail: 36px;
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
  min-height: var(--nav-rail);
  padding-inline: 2px;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}
.logo-mark {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--nav-rail);
  min-height: var(--nav-rail);
  border-radius: var(--radius-md);
}
.logo-mark img {
  width: 22px;
  height: 22px;
  object-fit: contain;
}
.logo-mark:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.collapse-toggle,
.rail-action {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: none;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.collapse-toggle:hover,
.rail-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
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

.session-list ul {
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
.more-button {
  display: flex;
  align-items: center;
  width: 100%;
  height: 30px;
  padding: 0 8px;
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
  gap: 8px;
  padding: 24px 8px;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  text-align: center;
}
.empty-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  font-size: 11px;
  font-weight: var(--font-weight-medium);
}
.empty-add:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.session-nav.collapsed .logo-row {
  overflow: visible;
  scrollbar-gutter: auto;
  width: var(--nav-rail);
  justify-content: center;
  padding-inline: 0;
}
</style>
