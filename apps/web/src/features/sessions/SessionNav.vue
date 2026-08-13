<template>
  <div class="session-nav">
    <header class="nav-masthead">
      <h2 id="workspaces-title">Workspaces</h2>
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
          <ChevronRight
            :size="14"
            class="workspace-chevron"
            :class="{ open: isExpanded(group.canonicalPath) }"
            aria-hidden="true"
          />
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
            <DropdownMenuItem variant="destructive" @select="revokeWorkspace(group.canonicalPath)">
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
            <div class="workspace-sessions">
              <p v-if="group.sessions.length === 0" class="notice">暂无 Session。使用“+”创建。</p>
              <nav
                v-else
                class="session-list"
                :aria-label="`${workspaceName(group.canonicalPath)} 的 Session 列表`"
              >
                <div v-for="session in group.sessions" :key="session.id" class="session-item">
                  <RouterLink
                    :to="{ name: 'session', params: { sessionId: session.id } }"
                    class="session-card"
                    :class="{ active: isActiveSession(group.canonicalPath, session.id) }"
                    :aria-current="
                      isActiveSession(group.canonicalPath, session.id) ? 'page' : undefined
                    "
                    @click="emit('navigate', group.canonicalPath)"
                  >
                    <span class="t">{{
                      session.sessionName || `Session ${session.id.slice(0, 8)}`
                    }}</span>
                    <span
                      v-if="
                        activeSessionRunning && isActiveSession(group.canonicalPath, session.id)
                      "
                      class="session-status active"
                      title="ACTIVE"
                    >
                      <span aria-hidden="true">ACTIVE</span>
                      <span class="sr-only">ACTIVE</span>
                    </span>
                  </RouterLink>
                </div>
              </nav>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, MoreVertical, Plus } from "lucide-vue-next";
import { useWorkspace } from "@app/hooks/use-app.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { workspaceName } from "@features/sessions/types.js";

const emit = defineEmits<{
  navigate: [canonicalPath: string];
}>();

const {
  groups,
  expandedWorkspaceIds,
  activeWorkspaceId,
  activeSessionId,
  activeSessionRunning,
  creating,
  addingWorkspace,
  sessionError: workspaceError,
  toggleWorkspace,
  addWorkspace,
  revokeWorkspace,
  createSession,
} = useWorkspace();

function isExpanded(canonicalPath: string): boolean {
  return expandedWorkspaceIds.value.has(canonicalPath);
}
function isActiveSession(canonicalPath: string, sessionId: string): boolean {
  return canonicalPath === activeWorkspaceId.value && sessionId === activeSessionId.value;
}
</script>

<style scoped>
.session-nav {
  min-width: 0;
}
.nav-masthead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--size-control);
  padding: 0 var(--spacing-xs) var(--spacing-xs);
}
.nav-masthead h2 {
  margin: 0;
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-semibold);
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
  gap: var(--spacing-xs);
  margin: 0;
  padding: 0;
  list-style: none;
}
.workspace-item {
  position: relative;
  min-width: 0;
  border-radius: var(--radius-lg);
}
.workspace-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-height: var(--size-control);
  padding: var(--spacing-xs) calc(3 * var(--size-nav-action)) var(--spacing-xs) var(--spacing-xs);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.workspace-row:hover {
  background: var(--surface);
}
.workspace-row.active .workspace-name {
  font-weight: var(--font-weight-semibold);
}
.workspace-folder,
.workspace-chevron {
  flex: none;
  color: var(--ink-faint);
}
.workspace-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.workspace-chevron {
  margin-left: auto;
  transition: transform var(--duration-normal) var(--ease-smooth);
}
.workspace-chevron.open {
  transform: rotate(90deg);
}
.workspace-create,
.workspace-kebab {
  position: absolute;
  top: calc((var(--size-control) - var(--size-nav-action)) / 2);
  z-index: 1;
  color: var(--ink-faint);
}
.workspace-create {
  right: calc(var(--size-nav-action) + var(--spacing-xxs));
}
.workspace-kebab {
  right: var(--spacing-xxs);
  opacity: 0;
}
.workspace-item:hover > .workspace-kebab,
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
.workspace-sessions {
  padding: 0 var(--spacing-xs) var(--spacing-xs) calc(var(--spacing-lg) + var(--spacing-xs));
}
.workspace-sessions > .notice {
  margin: var(--spacing-xxs) 0;
  padding: var(--spacing-xs);
  font-size: var(--text-caption);
}
.session-list {
  display: grid;
  gap: var(--spacing-xxs);
}
.session-item {
  position: relative;
}
.session-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: var(--size-control);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.session-card:hover,
.session-card.active {
  background: var(--canvas-soft);
}
.session-card:active {
  transform: scale(0.98);
}
.session-card .t {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-card.active .t {
  font-weight: var(--font-weight-semibold);
}
.session-card .session-status {
  flex: none;
  color: var(--accent-orange-deep);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-semibold);
}
@media (prefers-reduced-motion: reduce) {
  .workspace-reveal,
  .workspace-row,
  .workspace-chevron,
  .session-card {
    transition: none;
  }
}
</style>
