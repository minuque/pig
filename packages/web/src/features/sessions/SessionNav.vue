<template>
  <div class="session-nav">
    <header class="nav-masthead">
      <h2 id="workspaces-title">Workspaces</h2>
      <button
        class="icon-button"
        type="button"
        aria-label="授权新 Workspace"
        @click="emit('authorize')"
      >
        <Plus :size="16" aria-hidden="true" />
      </button>
    </header>

    <ul class="workspace-list" aria-labelledby="workspaces-title">
      <li v-for="workspace in workspaces" :key="workspace.id" class="workspace-item">
        <button
          class="workspace-row"
          type="button"
          :class="{
            expanded: isExpanded(workspace.id),
            active: workspace.id === activeWorkspaceId,
          }"
          :aria-expanded="isExpanded(workspace.id)"
          :title="workspace.canonicalPath"
          @click="emit('toggle-workspace', workspace.id)"
        >
          <component
            :is="isExpanded(workspace.id) ? FolderOpen : Folder"
            :size="16"
            class="workspace-folder"
            aria-hidden="true"
          />
          <span class="workspace-name">{{ projectName(workspace) }}</span>
          <ChevronRight
            :size="14"
            class="workspace-chevron"
            :class="{ open: isExpanded(workspace.id) }"
            aria-hidden="true"
          />
        </button>
        <button
          class="icon-button workspace-create"
          type="button"
          :aria-label="`创建 Session：${projectName(workspace)}`"
          :disabled="creatingWorkspaceId === workspace.id"
          @click="emit('create', workspace)"
        >
          <Plus :size="16" aria-hidden="true" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <button
              class="icon-button workspace-kebab"
              type="button"
              :aria-label="`操作 Workspace：${projectName(workspace)}`"
              @click.stop
            >
              <MoreVertical :size="16" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem variant="destructive" @select="revokeWorkspace(workspace)">
              撤销授权
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          class="workspace-reveal"
          :data-open="isExpanded(workspace.id)"
          :inert="!isExpanded(workspace.id)"
          :aria-hidden="!isExpanded(workspace.id)"
        >
          <div>
            <div class="workspace-sessions">
              <p v-if="loadingWorkspaceIds.has(workspace.id)" class="shimmer" role="status">
                正在加载 Sessions…
              </p>
              <div v-else-if="sessionErrors.get(workspace.id)" class="notice error" role="alert">
                <p>{{ sessionErrors.get(workspace.id) }}</p>
                <button type="button" @click="emit('retry', workspace.id)">重试</button>
              </div>
              <p v-else-if="sessionsOf(workspace).length === 0" class="notice">
                暂无 Session。使用“+”创建。
              </p>
              <nav
                v-else
                class="session-list"
                :aria-label="`${projectName(workspace)} 的 Session 列表`"
              >
                <div
                  v-for="session in sessionsOf(workspace)"
                  :key="session.id"
                  class="session-item"
                >
                  <RouterLink
                    :to="`/workspaces/${workspace.id}/sessions/${session.id}`"
                    class="session-card"
                    :class="{
                      active: workspace.id === activeWorkspaceId && session.id === activeSessionId,
                    }"
                    @click="emit('navigate', workspace.id)"
                  >
                    <span class="t">{{ session.name || `Session ${session.id.slice(0, 8)}` }}</span>
                    <span
                      class="session-status"
                      :class="statusOf(session)"
                      :title="statusLabel(session)"
                    >
                      <span aria-hidden="true">{{
                        statusOf(session) === "active" ? "ACTIVE" : "●"
                      }}</span>
                      <span class="sr-only">{{ statusLabel(session) }}</span>
                    </span>
                  </RouterLink>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <button
                        :ref="
                          (el) =>
                            kebabRefs.set(
                              sessionKey(workspace.id, session.id),
                              el as HTMLElement | null,
                            )
                        "
                        class="icon-button session-kebab"
                        type="button"
                        :aria-label="`操作 Session：${session.name || session.id.slice(0, 8)}`"
                        @click.stop
                      >
                        <MoreVertical :size="16" aria-hidden="true" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @select="openRename(session)">重命名</DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" @select="openDelete(session)">
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </nav>
              <button
                v-if="nextCursors.get(workspace.id)"
                class="secondary load-more"
                type="button"
                @click="emit('load-more', workspace.id)"
              >
                加载更多
              </button>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>

  <SessionRenameDialog
    v-if="renameTarget"
    :session="renameTarget.session"
    :trigger="renameTarget.trigger"
    @close="renameTarget = null"
    @rename="handleRename"
  />
  <SessionDeleteDialog
    v-if="deleteTarget"
    :session="deleteTarget.session"
    :trigger="deleteTarget.trigger"
    @close="deleteTarget = null"
    @delete="handleDelete"
  />
</template>

<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, MoreVertical, Plus } from "lucide-vue-next";
import { ref } from "vue";
import { RouterLink } from "vue-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu/index.js";
import type { SessionDto, WorkspaceDto } from "../../api/index.js";
import SessionDeleteDialog from "./SessionDeleteDialog.vue";
import SessionRenameDialog from "./SessionRenameDialog.vue";
import { sessionKey } from "./session-state.js";

const props = defineProps<{
  workspaces: WorkspaceDto[];
  activeWorkspaceId: string | undefined;
  expandedWorkspaceIds: Set<string>;
  sessionsByWorkspace: Map<string, SessionDto[]>;
  loadingWorkspaceIds: Set<string>;
  sessionErrors: Map<string, string>;
  nextCursors: Map<string, string | undefined>;
  activeSessionId: string | undefined;
  activeSessionHasRun: boolean;
  creatingWorkspaceId: string | undefined;
}>();

/** 项目名：优先 name，缺省回退到路径最后一段（Windows 反斜杠一并处理）。 */
function projectName(workspace: WorkspaceDto): string {
  const trimmed = workspace.name.trim();
  if (trimmed && trimmed !== "Workspace") return trimmed;
  const segments = workspace.canonicalPath.split(/[\\/]/).filter(Boolean);
  return segments[segments.length - 1] ?? workspace.canonicalPath;
}

const emit = defineEmits<{
  "toggle-workspace": [id: string];
  authorize: [];
  revoke: [workspace: WorkspaceDto];
  create: [workspace: WorkspaceDto];
  "load-more": [workspaceId: string];
  retry: [workspaceId: string];
  navigate: [workspaceId: string];
  rename: [session: SessionDto, name: string];
  delete: [session: SessionDto];
}>();

function isExpanded(id: string): boolean {
  return props.expandedWorkspaceIds.has(id);
}
function sessionsOf(workspace: WorkspaceDto): SessionDto[] {
  return props.sessionsByWorkspace.get(workspace.id) ?? [];
}
function statusOf(session: SessionDto): "active" | "available" | "unavailable" {
  if (
    session.workspaceId === props.activeWorkspaceId &&
    session.id === props.activeSessionId &&
    props.activeSessionHasRun
  )
    return "active";
  return session.status;
}
function statusLabel(session: SessionDto): string {
  const status = statusOf(session);
  return status === "active" ? "ACTIVE" : status === "available" ? "Available" : "Unavailable";
}

/* ── Workspace 菜单：撤销授权 ───────────────────────────────────── */
function revokeWorkspace(workspace: WorkspaceDto) {
  emit("revoke", workspace);
}

/* ── 重命名 / 删除 dialog（弹窗职责在子组件；此处记录目标与触发 kebab） ── */
// 关闭后子组件将焦点回落到触发 kebab（菜单项卸载后 reka 无法自行恢复）；
// Session id 跨 Workspace 不唯一，key 用 workspaceId:sessionId 组合
const kebabRefs = new Map<string, HTMLElement | null>();
const renameTarget = ref<{ session: SessionDto; trigger: HTMLElement | null } | null>(null);
const deleteTarget = ref<{ session: SessionDto; trigger: HTMLElement | null } | null>(null);

function openRename(session: SessionDto) {
  renameTarget.value = {
    session,
    trigger: kebabRefs.get(sessionKey(session.workspaceId, session.id)) ?? null,
  };
}
function openDelete(session: SessionDto) {
  deleteTarget.value = {
    session,
    trigger: kebabRefs.get(sessionKey(session.workspaceId, session.id)) ?? null,
  };
}
function handleRename(name: string) {
  const target = renameTarget.value;
  if (!target) return;
  renameTarget.value = null;
  emit("rename", target.session, name);
}
function handleDelete() {
  const target = deleteTarget.value;
  if (!target) return;
  deleteTarget.value = null;
  emit("delete", target.session);
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
.workspace-sessions > .notice,
.workspace-sessions > .shimmer {
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
  padding: var(--spacing-xs) var(--spacing-xl) var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.session-card:hover {
  background: var(--canvas-soft);
}
.session-card:active {
  transform: scale(0.98);
}
.session-card.active,
.session-card.router-link-active {
  background: var(--canvas-soft);
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
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-semibold);
}
.session-card .session-status.active {
  color: var(--accent-orange-deep);
}
.session-card .session-status.unavailable {
  color: var(--danger);
}
.session-kebab {
  position: absolute;
  top: var(--spacing-xs);
  right: var(--spacing-xs);
  width: var(--size-kebab);
  min-height: var(--size-kebab);
  padding: 0;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  opacity: 0;
  transition:
    opacity var(--duration-fast) var(--ease-smooth),
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.session-item:hover .session-kebab,
.session-kebab:focus-visible,
.session-kebab[aria-expanded="true"] {
  opacity: 1;
}
.session-kebab:hover {
  background: var(--canvas-soft);
  color: var(--ink);
}
.load-more {
  width: 100%;
  min-height: var(--size-nav-action);
  margin-top: var(--spacing-xxs);
  padding: var(--spacing-xxs) var(--spacing-xs);
  font-size: var(--text-caption);
}
@media (hover: none) {
  .session-kebab {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .workspace-reveal,
  .workspace-item,
  .workspace-row,
  .workspace-chevron,
  .session-card,
  .session-kebab {
    transition: none;
    animation: none;
  }
}
</style>
