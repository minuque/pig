<template>
  <div class="session-nav" :class="{ collapsed }">
    <!-- 仅桌面壳可见；win32 用系统 caption，不画侧栏拖条 -->
    <div class="titlebar-drag" aria-hidden="true"></div>

    <div class="logo-row">
      <Mascot
        v-if="!collapsed"
        class="brand-mascot"
        :size="22"
        :state="mascotState"
        :follow-pointer="false"
        label="pig"
      />
      <button
        class="icon-button collapse-toggle"
        type="button"
        :aria-expanded="!collapsed"
        aria-label="切换 Workspace 导航"
        @click="emit('toggle')"
      >
        <PanelLeft :size="16" aria-hidden="true" />
      </button>
    </div>

    <button
      class="new-session"
      type="button"
      :disabled="!newSessionPath || Boolean(creating)"
      :aria-label="collapsed ? '新会话' : undefined"
      :title="collapsed ? '新会话' : undefined"
      @click="onNewSession()"
    >
      <Plus :size="16" aria-hidden="true" />
      <span v-if="!collapsed">新会话</span>
    </button>

    <div v-show="!collapsed" ref="navBody" class="nav-body">
      <header class="nav-masthead">
        <h2 id="workspaces-title">工作区</h2>
        <button
          class="icon-button"
          type="button"
          :disabled="addingWorkspace"
          aria-label="添加本地目录"
          @click="addWorkspace()"
        >
          <Plus :size="16" aria-hidden="true" />
        </button>
      </header>

      <p v-if="workspaceError" class="notice error" role="alert">{{ workspaceError }}</p>

      <ul class="workspace-list" aria-labelledby="workspaces-title">
        <li v-for="group in groups" :key="group.canonicalPath" class="workspace-item">
          <button
            class="workspace-row"
            type="button"
            :class="{
              expanded: isExpanded(group.canonicalPath),
              active: group.canonicalPath === activeWorkspaceId,
            }"
            :aria-expanded="isExpanded(group.canonicalPath)"
            :title="group.canonicalPath"
            @click="toggleWorkspace(group.canonicalPath)"
          >
            <component
              :is="isExpanded(group.canonicalPath) ? FolderOpen : Folder"
              :size="16"
              class="workspace-folder"
              aria-hidden="true"
            />
            <span class="workspace-name">{{ workspaceName(group.canonicalPath) }}</span>
          </button>
          <button
            v-if="group.authorized"
            class="icon-button workspace-create"
            type="button"
            :aria-label="`创建 Session：${workspaceName(group.canonicalPath)}`"
            :disabled="Boolean(creating)"
            @click="createSession(group.canonicalPath)"
          >
            <Plus :size="16" aria-hidden="true" />
          </button>
          <DropdownMenu v-if="group.authorized">
            <DropdownMenuTrigger as-child>
              <button
                class="icon-button workspace-kebab"
                type="button"
                :aria-label="`操作目录：${workspaceName(group.canonicalPath)}`"
                @click.stop
              >
                <MoreVertical :size="16" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                @select="revokeWorkspace(group.canonicalPath)"
              >
                从列表移除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            class="workspace-reveal"
            :data-open="isExpanded(group.canonicalPath)"
            :inert="!isExpanded(group.canonicalPath)"
            :aria-hidden="!isExpanded(group.canonicalPath)"
          >
            <div>
              <!-- ponytail: 直接 v-for 渲染；单工作区会话上千时恢复虚拟列表 -->
              <nav
                class="workspace-sessions"
                :aria-label="`${workspaceName(group.canonicalPath)} 的会话列表`"
              >
                <p v-if="group.sessions.length === 0" class="notice">暂无会话</p>
                <template v-else>
                  <SessionItem
                    v-for="session in group.sessions"
                    :key="session.id"
                    :session="session"
                    :active="
                      group.canonicalPath === activeWorkspaceId && session.id === activeSessionId
                    "
                    :running="
                      activeSessionRunning &&
                      group.canonicalPath === activeWorkspaceId &&
                      session.id === activeSessionId
                    "
                    @navigate="emit('navigate', group.canonicalPath)"
                    @rename="renameSession"
                    @delete="deleteSession"
                  />
                </template>
              </nav>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import { Folder, FolderOpen, MoreVertical, PanelLeft, Plus } from "lucide-vue-next";
import { useNav } from "@features/session-nav/index.js";
import { useSession } from "@features/session-workbench/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import Mascot from "@features/mascot/index.vue";
import SessionItem from "@features/session-nav/components/SessionItem.vue";
import { mascotStateFromPhase } from "@features/mascot/lib/presence.js";
import { workspaceName } from "@features/session-nav/types.js";

defineProps<{
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  navigate: [canonicalPath: string];
  toggle: [];
}>();

const {
  groups,
  expandedWorkspaceIds,
  activeWorkspaceId,
  activeSessionId,
  activeSessionRunning,
  addingWorkspace,
  navError: workspaceError,
  toggleWorkspace,
  addWorkspace,
  revokeWorkspace,
  renameSession,
  deleteSession,
} = useNav();
const { creating, phase, createSession } = useSession();

const navBody = useTemplateRef<HTMLElement>("navBody");
const mascotState = computed(() =>
  creating.value ? "thinking" : mascotStateFromPhase(phase.value),
);

// 活动会话变化或工作区展开后，把活动项滚入视野
watch(
  () => [activeSessionId.value, activeWorkspaceId.value, expandedWorkspaceIds.value] as const,
  async () => {
    await nextTick();
    navBody.value
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  },
);

/** 优先当前授权 cwd，否则第一个已授权 workspace。 */
const newSessionPath = computed(() => {
  const authorized = groups.value.filter((group) => group.authorized);
  const active = activeWorkspaceId.value;
  if (active && authorized.some((group) => group.canonicalPath === active)) return active;
  return authorized[0]?.canonicalPath;
});

function onNewSession() {
  const path = newSessionPath.value;
  if (!path) return;
  void createSession(path);
}

function isExpanded(canonicalPath: string): boolean {
  return expandedWorkspaceIds.value.has(canonicalPath);
}
</script>

<style scoped>
.session-nav {
  --nav-row: 28px;
  --nav-rail: 36px;
  --nav-new: 36px;
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xs);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
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
}
.session-nav.collapsed .logo-row {
  width: var(--nav-rail);
  justify-content: center;
  padding-inline: 0;
}
.brand-mascot {
  flex: none;
  border-radius: 6px;
}
.collapse-toggle {
  display: flex;
  justify-content: center;
  align-items: center;

  flex: none;
  width: var(--nav-rail);
  min-height: var(--nav-rail);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
}
.collapse-toggle:hover {
  background: var(--surface);
  color: var(--ink);
}

.new-session {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
  width: 100%;
  height: var(--nav-new);
  min-height: var(--nav-new);
  padding: 0 var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
  font-size: var(--text-button);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-button--line-height);
}
.session-nav.collapsed .new-session {
  width: var(--nav-rail);
  height: var(--nav-rail);
  min-height: var(--nav-rail);
  padding: 0;
  border-radius: var(--radius-md);
}
.new-session:hover:not(:disabled) {
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}

.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
  overflow: auto;
}
.session-nav:not(:hover) .nav-body {
  scrollbar-color: transparent transparent;
}
.session-nav:not(:hover) .nav-body::-webkit-scrollbar-thumb {
  background: transparent;
}
.nav-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--nav-row);
  padding: 0 var(--spacing-xxs);
}
.nav-masthead h2 {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.nav-masthead .icon-button,
.workspace-create,
.workspace-kebab {
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
}
.nav-masthead .icon-button:disabled {
  opacity: 0.5;
}
.workspace-list {
  display: grid;
  gap: var(--spacing-xxs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.workspace-item {
  position: relative;
  min-width: 0;
}
.workspace-row {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: var(--nav-row);
  padding: 4px 8px;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  text-align: left;
}
.workspace-row:hover {
  background: color-mix(in srgb, var(--ink) 5%, transparent);
}
.workspace-row.active .workspace-name,
.workspace-row.expanded .workspace-name {
  font-weight: var(--font-weight-medium);
}
.workspace-folder {
  flex: none;
  color: var(--ink-faint);
}
.workspace-name {
  min-width: 0;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-sm);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-create,
.workspace-kebab {
  position: absolute;
  top: calc((var(--nav-row) - var(--size-nav-action)) / 2);
  z-index: 1;
  color: var(--ink-faint);
  opacity: 0;
}
.workspace-create {
  right: calc(var(--size-nav-action) + 2px);
}
.workspace-kebab {
  right: 2px;
}
.workspace-item:hover > .workspace-create,
.workspace-item:hover > .workspace-kebab,
.workspace-create:focus-visible,
.workspace-kebab:focus-visible,
.workspace-kebab[aria-expanded="true"] {
  opacity: 1;
}
.workspace-reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-smooth);
}
.workspace-reveal[data-open="true"] {
  grid-template-rows: 1fr;
}
.workspace-reveal > div {
  overflow: hidden;
}
.workspace-sessions > .notice {
  margin: var(--spacing-xxs) 0;
  padding: var(--spacing-xs);
  font-size: var(--text-caption);
}
@media (prefers-reduced-motion: reduce) {
  .workspace-reveal {
    transition: none;
  }
}
</style>
