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

  <Dialog :open="Boolean(dialog)" @update:open="onDialogOpenChange">
    <DialogContent @close-auto-focus="onCloseAutoFocus">
      <DialogHeader>
        <DialogTitle>{{
          dialog?.mode === "rename" ? "重命名 Session" : "删除 Session"
        }}</DialogTitle>
        <DialogDescription v-if="dialog?.mode === 'rename'"
          >输入该 Session 的新名称。</DialogDescription
        >
        <DialogDescription v-else>
          删除“{{
            dialog?.session.name || dialog?.session.id.slice(0, 8)
          }}”的本地索引？此操作不可撤销。
        </DialogDescription>
      </DialogHeader>
      <input
        v-if="dialog?.mode === 'rename'"
        ref="renameInput"
        v-model="renameDraft"
        class="rename-input"
        aria-label="Session 名称"
        maxlength="200"
        @keydown.enter="submitRename"
      />
      <DialogFooter>
        <button class="secondary" type="button" @click="closeDialog">取消</button>
        <button v-if="dialog?.mode === 'delete'" class="danger" type="button" @click="submitDelete">
          删除
        </button>
        <button v-else type="button" @click="submitRename">保存</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ChevronRight, Folder, FolderOpen, MoreVertical, Plus } from "lucide-vue-next";
import { nextTick, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog/index.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu/index.js";
import type { SessionDto, WorkspaceDto } from "../../api/index.js";
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

/* ── 重命名 / 删除 dialog（受控 open，reka 管理焦点/Escape/外点关闭） ── */
const dialog = ref<{ session: SessionDto; mode: "rename" | "delete" } | null>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement>();
// 关闭后焦点回触发 kebab（菜单项卸载后 reka 无法自行恢复）；
// Session id 跨 Workspace 不唯一，key 用 workspaceId:sessionId 组合
const kebabRefs = new Map<string, HTMLElement | null>();
let pendingFocus: HTMLElement | null = null;

function openRename(session: SessionDto) {
  renameDraft.value = session.name ?? "";
  pendingFocus = kebabRefs.get(sessionKey(session.workspaceId, session.id)) ?? null;
  dialog.value = { session, mode: "rename" };
}
function openDelete(session: SessionDto) {
  pendingFocus = kebabRefs.get(sessionKey(session.workspaceId, session.id)) ?? null;
  dialog.value = { session, mode: "delete" };
}
function onDialogOpenChange(open: boolean) {
  if (!open) closeDialog();
}
function closeDialog() {
  dialog.value = null;
  renameDraft.value = "";
}
// reka 关闭 dialog 前触发：焦点回触发 kebab（阻止默认聚焦 body）
function onCloseAutoFocus(event: Event) {
  event.preventDefault();
  pendingFocus?.focus();
  pendingFocus = null;
}
function submitRename() {
  if (!dialog.value || !renameDraft.value.trim()) return;
  const { session } = dialog.value;
  const name = renameDraft.value.trim();
  closeDialog();
  emit("rename", session, name);
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
