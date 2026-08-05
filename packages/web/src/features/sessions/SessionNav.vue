<template>
  <label class="workspace-picker">
    <select
      aria-label="当前 Workspace"
      :value="workspace?.id"
      @change="emit('select-workspace', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="item in workspaces" :key="item.id" :value="item.id">
        {{ item.name }}
      </option>
    </select>
    <span class="workspace-picker-label">
      <span class="wp-main">{{ workspace?.name ?? "未授权" }}</span>
      <span v-if="workspace" class="wp-path">{{ workspace.canonicalPath }}</span>
      <span class="wp-caret" aria-hidden="true">▾</span>
    </span>
  </label>
  <div class="actions compact-actions">
    <button class="secondary" type="button" @click="emit('authorize')">授权</button>
    <button class="secondary" type="button" :disabled="!workspace" @click="emit('revoke')">
      Revoke
    </button>
  </div>

  <section aria-labelledby="sessions-title">
    <div class="section-title">
      <h2 id="sessions-title">Sessions</h2>
      <button
        class="icon-button"
        type="button"
        aria-label="创建 Session"
        :disabled="!workspace || creating"
        @click="emit('create')"
      >
        ＋
      </button>
    </div>
    <p v-if="loadingSessions" class="shimmer" role="status">正在加载 Sessions…</p>
    <div v-else-if="sessionError" class="notice error" role="alert">
      <p>{{ sessionError }}</p>
      <button type="button" @click="emit('retry')">重试</button>
    </div>
    <p v-else-if="workspace && sessions.length === 0" class="notice">
      暂无 Session。使用“创建 Session”开始。
    </p>
    <nav v-else aria-label="Session 列表">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ unavailable: session.status === 'unavailable' }"
      >
        <RouterLink
          :to="`/sessions/${session.id}`"
          class="session-card"
          @click="
            menuSession = null;
            emit('navigate');
          "
        >
          <span class="t">{{ session.name || `Session ${session.id.slice(0, 8)}` }}</span>
          <small class="m">
            <span
              class="dot"
              aria-hidden="true"
              :style="{
                backgroundColor:
                  session.status === 'available'
                    ? 'var(--accent-green)'
                    : 'var(--accent-orange-deep)',
              }"
            ></span>
            {{ session.status === "available" ? "Available" : "Unavailable" }}
            <span class="time">{{ formatTime(session.updatedAt) }}</span>
          </small>
        </RouterLink>
        <button
          class="icon-button session-kebab"
          type="button"
          :aria-label="`操作 Session：${session.name || session.id.slice(0, 8)}`"
          :aria-expanded="menuSession?.id === session.id"
          @click.stop="toggleMenu(session, $event)"
        >
          <MoreVertical :size="16" aria-hidden="true" />
        </button>
        <div v-if="menuSession?.id === session.id" class="session-menu" role="menu">
          <button type="button" role="menuitem" @click="openRename(session)">重命名</button>
          <button type="button" role="menuitem" class="danger-text" @click="openDelete(session)">
            删除
          </button>
        </div>
      </div>
    </nav>
    <button v-if="nextCursor" class="secondary" type="button" @click="emit('load-more')">
      加载更多
    </button>
  </section>

  <Teleport to="body">
    <div v-if="menuSession" class="menu-scrim" @click="menuSession = null"></div>
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
import { MoreVertical } from "lucide-vue-next";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { SessionDto, WorkspaceDto } from "../../api/index.js";

defineProps<{
  workspace?: WorkspaceDto | undefined;
  workspaces: WorkspaceDto[];
  sessions: SessionDto[];
  loadingSessions: boolean;
  creating: boolean;
  nextCursor?: string | undefined;
  sessionError: string;
}>();

const emit = defineEmits<{
  "select-workspace": [id: string];
  authorize: [];
  revoke: [];
  create: [];
  "load-more": [];
  retry: [];
  navigate: [];
  rename: [session: SessionDto, name: string];
  delete: [session: SessionDto];
}>();

const menuSession = ref<SessionDto | null>(null);
const dialog = ref<{ session: SessionDto; mode: "rename" | "delete" } | null>(null);
const renameDraft = ref("");
const renameInput = ref<HTMLInputElement>();
const menuTrigger = ref<HTMLElement | null>(null);

function toggleMenu(session: SessionDto, event: MouseEvent) {
  menuSession.value = menuSession.value?.id === session.id ? null : session;
  if (menuSession.value) menuTrigger.value = event.currentTarget as HTMLElement;
}
function closeMenu() {
  menuSession.value = null;
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    if (dialog.value) closeDialog();
    else closeMenu();
  }
}
window.addEventListener("keydown", onKeydown);
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

function openRename(session: SessionDto) {
  closeMenu();
  renameDraft.value = session.name ?? "";
  dialog.value = { session, mode: "rename" };
}
function openDelete(session: SessionDto) {
  closeMenu();
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

function formatTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.floor((Date.now() - time) / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return new Date(time).toLocaleDateString();
}
</script>
