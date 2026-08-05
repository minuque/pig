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
          <span class="workspace-name">{{ workspace.name }}</span>
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
          :aria-label="`创建 Session：${workspace.name}`"
          :disabled="creatingWorkspaceId === workspace.id"
          @click="emit('create', workspace)"
        >
          <Plus :size="16" aria-hidden="true" />
        </button>
        <button
          class="icon-button workspace-kebab"
          type="button"
          :aria-label="`操作 Workspace：${workspace.name}`"
          :aria-expanded="menuWorkspace?.id === workspace.id"
          @click="toggleWorkspaceMenu(workspace, $event)"
        >
          <MoreVertical :size="16" aria-hidden="true" />
        </button>
        <div v-if="menuWorkspace?.id === workspace.id" class="session-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            class="danger-text"
            @click="revokeWorkspace(workspace)"
          >
            撤销授权
          </button>
        </div>

        <div v-if="isExpanded(workspace.id)" class="workspace-sessions">
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
          <nav v-else class="session-list" :aria-label="`${workspace.name} 的 Session 列表`">
            <div v-for="session in sessionsOf(workspace)" :key="session.id" class="session-item">
              <RouterLink
                :to="`/workspaces/${workspace.id}/sessions/${session.id}`"
                class="session-card"
                :class="{ active: session.id === activeSessionId }"
                @click="emit('navigate', workspace.id)"
              >
                <span class="t">{{ session.name || `Session ${session.id.slice(0, 8)}` }}</span>
                <span class="session-status" :class="statusOf(session)">
                  {{ statusLabel(session) }}
                </span>
              </RouterLink>
              <button
                class="icon-button session-kebab"
                type="button"
                :aria-label="`操作 Session：${session.name || session.id.slice(0, 8)}`"
                :aria-expanded="menuSession?.id === session.id"
                @click.stop="toggleSessionMenu(session, $event)"
              >
                <MoreVertical :size="16" aria-hidden="true" />
              </button>
              <div v-if="menuSession?.id === session.id" class="session-menu" role="menu">
                <button type="button" role="menuitem" @click="openRename(session)">重命名</button>
                <button
                  type="button"
                  role="menuitem"
                  class="danger-text"
                  @click="openDelete(session)"
                >
                  删除
                </button>
              </div>
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
      </li>
    </ul>
  </div>

  <Teleport to="body">
    <div v-if="menuSession || menuWorkspace" class="menu-scrim" @click="closeMenus"></div>
  </Teleport>

  <Teleport to="body">
    <div v-if="dialog" class="modal-backdrop" @click.self="closeDialog">
      <section
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="dialog.mode === 'rename' ? 'rename-title' : 'delete-title'"
      >
        <template v-if="dialog.mode === 'rename'">
          <h2 id="rename-title">重命名 Session</h2>
          <input
            ref="renameInput"
            v-model="renameDraft"
            class="rename-input"
            aria-label="Session 名称"
            maxlength="200"
            @keydown.enter="submitRename"
          />
        </template>
        <template v-else>
          <h2 id="delete-title">删除 Session</h2>
          <p class="dialog-note">
            删除“{{
              dialog.session.name || dialog.session.id.slice(0, 8)
            }}”的本地索引？此操作不可撤销。
          </p>
        </template>
        <div class="actions dialog-actions">
          <button class="secondary" type="button" @click="closeDialog">取消</button>
          <button
            v-if="dialog.mode === 'delete'"
            class="danger"
            type="button"
            @click="submitDelete"
          >
            删除
          </button>
          <button v-else type="button" @click="submitRename">保存</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, MoreVertical, Plus } from "lucide-vue-next";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { SessionDto, WorkspaceDto } from "../../api/index.js";

const props = defineProps<{
  workspaces: WorkspaceDto[];
  activeWorkspaceId?: string;
  expandedWorkspaceIds: Set<string>;
  sessionsByWorkspace: Map<string, SessionDto[]>;
  loadingWorkspaceIds: Set<string>;
  sessionErrors: Map<string, string>;
  nextCursors: Map<string, string | undefined>;
  activeSessionId?: string;
  activeSessionHasRun: boolean;
  creatingWorkspaceId?: string;
}>();

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
  if (session.id === props.activeSessionId && props.activeSessionHasRun) return "active";
  return session.status;
}
function statusLabel(session: SessionDto): string {
  const status = statusOf(session);
  return status === "active" ? "ACTIVE" : status === "available" ? "Available" : "Unavailable";
}

/* ── 菜单（Workspace 撤销 / Session 重命名·删除） ─────────────────── */
const menuSession = ref<SessionDto | null>(null);
const menuWorkspace = ref<WorkspaceDto | null>(null);
const menuTrigger = ref<HTMLElement | null>(null);

function toggleWorkspaceMenu(workspace: WorkspaceDto, event: MouseEvent) {
  menuWorkspace.value = menuWorkspace.value?.id === workspace.id ? null : workspace;
  if (menuWorkspace.value) {
    menuSession.value = null;
    menuTrigger.value = event.currentTarget as HTMLElement;
  }
}
function toggleSessionMenu(session: SessionDto, event: MouseEvent) {
  menuSession.value = menuSession.value?.id === session.id ? null : session;
  if (menuSession.value) {
    menuWorkspace.value = null;
    menuTrigger.value = event.currentTarget as HTMLElement;
  }
}
function closeMenus() {
  menuSession.value = null;
  menuWorkspace.value = null;
}
function revokeWorkspace(workspace: WorkspaceDto) {
  closeMenus();
  emit("revoke", workspace);
}
function onKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (dialog.value) closeDialog();
  else closeMenus();
}
window.addEventListener("keydown", onKeydown);
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

/* ── 重命名 / 删除 dialog ────────────────────────────────────────── */
const dialog = ref<{ session: SessionDto; mode: "rename" | "delete" } | null>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement>();

function openRename(session: SessionDto) {
  closeMenus();
  renameDraft.value = session.name ?? "";
  dialog.value = { session, mode: "rename" };
}
function openDelete(session: SessionDto) {
  closeMenus();
  dialog.value = { session, mode: "delete" };
}
function closeDialog() {
  dialog.value = null;
  menuTrigger.value?.focus();
  menuTrigger.value = null;
}
function submitRename() {
  if (!dialog.value || !renameDraft.value.trim()) return;
  const { session } = dialog.value;
  closeDialog();
  emit("rename", session, renameDraft.value.trim());
}
function submitDelete() {
  if (!dialog.value) return;
  const { session } = dialog.value;
  closeDialog();
  emit("delete", session);
}
watch(
  () => dialog.value?.mode,
  async (mode) => {
    if (mode === "rename") {
      await nextTick();
      renameInput.value?.focus();
      renameInput.value?.select();
    }
  },
);
</script>
