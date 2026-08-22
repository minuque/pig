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
        :disabled="!newSessionPath || Boolean(creating)"
        aria-label="新会话"
        title="新会话"
        @click="onNewSession()"
      >
        <SquarePen :size="16" aria-hidden="true" />
      </button>
    </template>

    <div v-show="!collapsed" class="nav-main">
      <div v-if="groups.length > 0" class="nav-toolbar">
        <div class="search-row">
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
          <button
            class="icon-button toolbar-icon"
            type="button"
            :disabled="!newSessionPath || Boolean(creating)"
            aria-label="新会话"
            title="新会话"
            @click="onNewSession()"
          >
            <SquarePen :size="16" aria-hidden="true" />
          </button>
        </div>
        <div class="scope-row">
          <div class="scope-menu">
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button class="scope-trigger" type="button" aria-label="按工作目录筛选会话">
                  <Folder :size="16" aria-hidden="true" />
                  <span class="scope-label">{{ scopedGroupName }}</span>
                  <ChevronDown :size="16" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" class="select-none">
                <DropdownMenuItem @select="clearProjectScope">
                  <Folder :size="16" aria-hidden="true" />
                  <span class="min-w-0 flex-1 truncate">全部工作目录</span>
                  <Check v-if="projectScope.length === 0" :size="14" aria-hidden="true" />
                </DropdownMenuItem>
                <DropdownMenuItem
                  v-for="group in groups"
                  :key="group.canonicalPath"
                  :title="group.canonicalPath"
                  @select="onToggleScope($event, group.canonicalPath)"
                >
                  <Folder :size="16" aria-hidden="true" />
                  <span class="min-w-0 flex-1 truncate">{{
                    workspaceName(group.canonicalPath)
                  }}</span>
                  <Check
                    v-if="projectScope.includes(group.canonicalPath)"
                    :size="14"
                    aria-hidden="true"
                  />
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
          <ul v-if="visibleSessions.length > 0" v-bind="wrapperProps" role="list">
            <li v-for="item in list" :key="item.data.id">
              <SessionItem
                :session="item.data"
                :workspace-title="item.data.cwd ? workspaceName(item.data.cwd) : ''"
                :active="item.data.id === activeSessionId"
                :running="activeSessionRunning && item.data.id === activeSessionId"
                :message-count="cardFootById.get(item.data.id)?.messageCount ?? null"
                :model-label="cardFootById.get(item.data.id)?.modelLabel ?? ''"
                :model-provider="cardFootById.get(item.data.id)?.modelProvider ?? ''"
                @navigate="onSessionNavigate(item.data.cwd)"
                @rename="renameSession"
                @delete="deleteSession"
              />
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
            <span v-else-if="searchQuery.trim()">没有匹配的会话</span>
            <span v-else-if="projectScope.length">「{{ scopedGroupName }}」暂无会话</span>
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
import { computed, nextTick, shallowRef, watch } from "vue";
import { useVirtualList } from "@vueuse/core";
import { RouterLink } from "vue-router";
import {
  Check,
  ChevronDown,
  Folder,
  FolderPlus,
  PanelLeft,
  Plus,
  Search,
  Settings,
  SquarePen,
} from "lucide-vue-next";
import { notify } from "@components/ui/alert/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { useNav } from "@features/session-nav/index.js";
import { useSession } from "@features/session-workbench/index.js";
import SessionItem from "@features/session-nav/components/SessionItem.vue";
import { workspaceName, workspaceScopeLabel } from "@features/session-nav/format.js";
import { filterSessionsForSearch } from "@features/session-nav/sidebar.js";

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  navigate: [canonicalPath: string];
  toggle: [];
}>();

const {
  groups,
  listedSessions,
  cardFootById,
  projectScope,
  toggleProjectScope,
  clearProjectScope,
  activeWorkspaceId,
  activeSessionId,
  activeSessionRunning,
  addingWorkspace,
  navError: workspaceError,
  addWorkspace,
  renameSession,
  deleteSession,
} = useNav();
const { creating, createSession } = useSession();

const searchQuery = shallowRef("");
const visibleSessions = computed(() =>
  filterSessionsForSearch(listedSessions.value, searchQuery.value),
);

/* 卡片 4.875rem + 行间 8px */
const SESSION_ROW_PX = 86;
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(visibleSessions, {
  itemHeight: SESSION_ROW_PX,
});
const scopedGroupName = computed(() => workspaceScopeLabel(projectScope.value));

watch(workspaceError, (message) => {
  const text = message.trim();
  if (text) notify.error(text);
});

watch(
  () => [activeSessionId.value, visibleSessions.value] as const,
  async () => {
    await nextTick();
    const id = activeSessionId.value;
    const index = visibleSessions.value.findIndex((session) => session.id === id);
    if (index >= 0) scrollTo(index);
  },
);

/** 筛选到一个目录时用它；多选时优先当前会话 cwd。否则当前会话 cwd 或列表第一项。 */
const newSessionPath = computed(() => {
  const paths = groups.value.map((group) => group.canonicalPath);
  const scoped = projectScope.value.filter((path) => paths.includes(path));
  if (scoped.length === 1) return scoped[0];
  if (scoped.length > 1) {
    const active = activeWorkspaceId.value;
    if (active && scoped.includes(active)) return active;
    return scoped[0];
  }
  const active = activeWorkspaceId.value;
  if (active && paths.includes(active)) return active;
  return paths[0];
});

function onToggleScope(event: Event, path: string) {
  event.preventDefault();
  toggleProjectScope(path);
}

function onNewSession() {
  const path = newSessionPath.value;
  if (!path) return;
  void createSession(path);
}

function onSessionNavigate(cwd: string | undefined) {
  if (cwd) emit("navigate", cwd);
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
.toolbar-icon {
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
  color: var(--on-primary);
}
.collapse-toggle:hover,
.rail-action:hover:not(:disabled),
.toolbar-icon:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--on-primary);
}
.rail-action:disabled,
.toolbar-icon:disabled {
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
.session-nav:not(:hover) .nav-body {
  scrollbar-color: transparent transparent;
}
.session-nav:not(:hover) .nav-body::-webkit-scrollbar-thumb {
  background: transparent;
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
.search-row,
.scope-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.scope-menu {
  display: flex;
  flex: 1;
  min-width: 0;
}
.toolbar-icon {
  margin-left: auto;
}
.search-field,
.scope-trigger {
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
.scope-trigger:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
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
.scope-trigger {
  width: 100%;
  color: var(--ink);
  text-align: left;
}
.scope-label {
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
  padding-bottom: var(--spacing-xs);
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
  color: var(--on-primary);
}
.settings-placeholder:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
  color: var(--on-primary);
}
</style>
