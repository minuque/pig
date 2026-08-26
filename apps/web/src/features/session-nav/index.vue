<template>
  <div class="session-nav" :class="{ collapsed }">
    <!-- 仅桌面壳可见；win32 用系统 caption，不画侧栏拖条 -->
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="logo-row">
      <RouterLink v-if="!collapsed" to="/" class="logo-mark" aria-label="返回欢迎页">
        <img src="/logo.png" alt="" width="22" height="22" />
      </RouterLink>
      <button
        class="icon-button collapse-toggle"
        type="button"
        :aria-expanded="!collapsed"
        aria-label="切换工作目录导航"
        @click="emit('toggle')"
      >
        <PanelLeft :size="16" aria-hidden="true" />
      </button>
    </div>

    <template v-if="collapsed">
      <button
        class="icon-button rail-action"
        type="button"
        :disabled="Boolean(creating)"
        aria-label="新会话"
        title="新会话"
        @click="onNewSession()"
      >
        <SquarePen :size="16" aria-hidden="true" />
      </button>
    </template>

    <div v-show="!collapsed" class="nav-main">
      <div class="nav-toolbar">
        <button
          class="new-task"
          type="button"
          :disabled="Boolean(creating)"
          aria-label="新会话"
          @click="onNewSession()"
        >
          <SquarePen :size="16" aria-hidden="true" />
          <span>新会话</span>
        </button>
        <label class="search-field">
          <Search :size="16" aria-hidden="true" />
          <input
            v-model="searchQuery"
            class="search-input"
            type="search"
            placeholder="搜索"
            aria-label="搜索会话"
            autocomplete="off"
          />
        </label>
        <div class="grouping-row">
          <div class="grouping-menu">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button class="grouping-trigger" type="button" aria-label="切换会话分组">
                  <span class="grouping-label">{{ groupingLabel }}</span>
                  <ChevronDown :size="16" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="select-none">
                <DropdownMenuItem @select="setGrouping('updated')">
                  <span class="min-w-0 flex-1 truncate">更新时间</span>
                  <Check v-if="grouping === 'updated'" :size="14" aria-hidden="true" />
                </DropdownMenuItem>
                <DropdownMenuItem @select="setGrouping('project')">
                  <span class="min-w-0 flex-1 truncate">项目</span>
                  <Check v-if="grouping === 'project'" :size="14" aria-hidden="true" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <button
            class="icon-button toolbar-icon"
            type="button"
            :disabled="addingWorkspace"
            aria-label="添加本地目录"
            title="添加本地目录"
            @click="addWorkspace()"
          >
            <FolderPlus :size="16" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-bind="containerProps" class="nav-body">
        <nav class="session-list" aria-label="会话列表">
          <ul v-if="showList" v-bind="wrapperProps" role="list">
            <li v-for="item in list" :key="item.data.key" :class="`row-${item.data.kind}`">
              <div v-if="item.data.kind === 'group'" class="group-head">
                <span class="group-name">{{ workspaceName(item.data.canonicalPath) }}</span>
                <button
                  class="icon-button group-new"
                  type="button"
                  :disabled="Boolean(creating)"
                  aria-label="在此目录新建会话"
                  title="新会话"
                  @click="createSession(item.data.canonicalPath)"
                >
                  <SquarePen :size="16" aria-hidden="true" />
                </button>
              </div>
              <SessionItem
                v-else-if="item.data.kind === 'session'"
                :session="item.data.session"
                :workspace-title="item.data.session.cwd ? workspaceName(item.data.session.cwd) : ''"
                :active="item.data.session.id === activeSessionId"
                :running="phase === 'turn' && item.data.session.id === activeSessionId"
                :grouping="grouping"
                :now="now"
                :message-count="cardFootById.get(item.data.session.id)?.messageCount ?? null"
                :model-label="cardFootById.get(item.data.session.id)?.modelLabel ?? ''"
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
                <Plus :size="12" aria-hidden="true" />
                添加本地目录
              </button>
            </template>
            <span v-else-if="searching">没有匹配的会话</span>
            <span v-else>暂无会话</span>
          </div>
        </nav>
      </div>
    </div>

    <div class="nav-foot">
      <button class="icon-button settings-placeholder" type="button" aria-label="设置">
        <Settings :size="16" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, shallowRef, watch } from "vue"
import { useTimestamp, useVirtualList } from "@vueuse/core"
import { RouterLink, useRouter } from "vue-router"
import {
  Check,
  ChevronDown,
  FolderPlus,
  PanelLeft,
  Plus,
  Search,
  Settings,
  SquarePen,
} from "lucide-vue-next"
import { notify } from "@components/ui/alert/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { canonicalizeWorkspacePath } from "@client/local-cwd.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { workspaceName } from "@features/session-nav/format.js"
import {
  filterSessionsForSearch,
  shouldFollowActiveSession,
} from "@features/session-nav/sidebar.js"

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
  setGrouping,
  bumpGroup,
  rowsFor,
  activeWorkspaceId,
  activeSessionId,
  lastCwd,
  addingWorkspace,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav()
const { creating, createSession, phase } = useSession()

const searchQuery = shallowRef("")
const now = useTimestamp({ interval: 60_000 })
const searching = computed(() => searchQuery.value.trim() !== "")
const visibleSessions = computed(() =>
  filterSessionsForSearch(listedSessions.value, searchQuery.value),
)
const rows = rowsFor(searching, visibleSessions)
const groupingLabel = computed(() => (grouping.value === "project" ? "项目" : "更新时间"))
const showList = computed(() =>
  searching.value ? rows.value.some((row) => row.kind === "session") : rows.value.length > 0,
)

const GROUP_ROW_PX = 32
const SESSION_ROW_PX = 56
const MORE_ROW_PX = 34
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(rows, {
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

const followedSessionId = shallowRef<string | undefined>()

watch(
  () => [activeSessionId.value, rows.value] as const,
  async () => {
    const id = activeSessionId.value
    if (!id) {
      followedSessionId.value = undefined
      return
    }
    if (!shouldFollowActiveSession(id, followedSessionId.value)) return
    await nextTick()
    const index = rows.value.findIndex((row) => row.kind === "session" && row.session.id === id)
    if (index < 0) return
    scrollTo(index)
    followedSessionId.value = id
  },
)

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
.rail-action,
.toolbar-icon,
.group-new {
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
.rail-action:hover:not(:disabled),
.toolbar-icon:hover:not(:disabled),
.group-new:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.rail-action:disabled,
.toolbar-icon:disabled,
.group-new:disabled {
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

.nav-toolbar {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--spacing-xs);
  padding-inline: 2px;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}
.grouping-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.grouping-menu {
  display: flex;
  flex: 1;
  min-width: 0;
}
.toolbar-icon {
  margin-left: auto;
}
.search-field,
.grouping-trigger,
.new-task {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.search-field {
  cursor: text;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.grouping-trigger:hover,
.new-task:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
.new-task:disabled {
  opacity: 0.45;
}
.new-task {
  width: 100%;
  flex: none;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-align: left;
}
.search-input {
  min-width: 0;
  flex: 1;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font-size: var(--text-body-sm);
  appearance: none;
  user-select: text;
}
.search-input::placeholder {
  color: var(--ink-faint);
}
.search-input::-webkit-search-cancel-button {
  display: none;
}
.grouping-trigger {
  width: 100%;
  color: var(--ink);
  text-align: left;
}
.grouping-label {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
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
.group-head {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding-inline: 8px;
}
.group-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
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
.more-button:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
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
.nav-foot {
  display: flex;
  flex: none;
  align-items: center;
  width: 100%;
  min-height: var(--nav-rail);
  padding-inline: 2px;
  margin-top: auto;
  overflow-y: hidden;
  scrollbar-gutter: stable;
}
.session-nav.collapsed .logo-row,
.session-nav.collapsed .nav-foot {
  overflow: visible;
  scrollbar-gutter: auto;
  width: var(--nav-rail);
  justify-content: center;
  padding-inline: 0;
}
.settings-placeholder {
  display: grid;
  place-items: center;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.settings-placeholder:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--ink);
}
</style>
