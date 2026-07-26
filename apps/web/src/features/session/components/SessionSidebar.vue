<script setup lang="ts">
import type {
  SessionAvailability,
  SessionId,
  SessionSummary,
  WorkspaceId,
} from "@no-pi-no-gang/contracts";
import { useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useGatewayClient } from "@/lib/gateway/client-context";
import { gatewayKeys } from "@/lib/gateway/keys";
import { newCommandId } from "@/lib/utils/command";

/**
 * Session list of the selected Workspace: search, create, select, rename,
 * and delete (two-step inline confirm). Availability problems surface as
 * text badges — quarantined/unavailable Sessions remain visible but their
 * state is never communicated by color alone.
 */
const props = defineProps<{
  workspaceId: WorkspaceId | undefined;
  activeSessionId: SessionId | undefined;
}>();
const emit = defineEmits<{
  select: [SessionId];
  deleted: [SessionId];
}>();

const client = useGatewayClient();
const queryClient = useQueryClient();

const search = ref("");
const listQuery = useQuery({
  queryKey: computed(() =>
    gatewayKeys.sessions.list(
      props.workspaceId ?? ("__none__" as WorkspaceId),
      search.value,
    ),
  ),
  queryFn: () => {
    const workspaceId = props.workspaceId;
    if (workspaceId === undefined) throw new Error("workspaceId is required");
    return client.sessions.list({ workspaceId, search: search.value });
  },
  enabled: computed(() => props.workspaceId !== undefined),
});
const sessions = computed(() => listQuery.data.value?.items ?? []);

const AVAILABILITY_LABELS: Record<SessionAvailability, string> = {
  healthy: "",
  dirty_tail: "待校验",
  unavailable: "不可用",
  quarantined: "已隔离",
};

function availabilityLabel(session: SessionSummary): string {
  return AVAILABILITY_LABELS[session.availability] ?? "不可用";
}

const newName = ref("");
const actionError = ref<string | null>(null);

async function createSession(): Promise<void> {
  const workspaceId = props.workspaceId;
  const name = newName.value.trim();
  if (workspaceId === undefined || name === "") return;
  actionError.value = null;
  try {
    const result = await client.sessions.create({
      workspaceId,
      commandId: newCommandId(),
      name,
    });
    newName.value = "";
    await queryClient.invalidateQueries({
      queryKey: [...gatewayKeys.sessions.all, "list"],
    });
    emit("select", result.result.sessionId);
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : "创建会话失败";
  }
}

const renamingId = ref<SessionId | null>(null);
const renameValue = ref("");

function startRename(session: SessionSummary): void {
  renamingId.value = session.sessionId;
  renameValue.value = session.name;
}

async function submitRename(session: SessionSummary): Promise<void> {
  const name = renameValue.value.trim();
  if (name === "" || name === session.name) {
    renamingId.value = null;
    return;
  }
  actionError.value = null;
  try {
    await client.sessions.update({
      sessionId: session.sessionId,
      commandId: newCommandId(),
      expectedRevision: session.revision,
      name,
    });
    renamingId.value = null;
    await queryClient.invalidateQueries({
      queryKey: [...gatewayKeys.sessions.all, "list"],
    });
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : "重命名失败";
  }
}

const confirmingDeleteId = ref<SessionId | null>(null);

async function deleteSession(session: SessionSummary): Promise<void> {
  actionError.value = null;
  try {
    await client.sessions.delete({
      sessionId: session.sessionId,
      commandId: newCommandId(),
      expectedRevision: session.revision,
    });
    confirmingDeleteId.value = null;
    await queryClient.invalidateQueries({
      queryKey: [...gatewayKeys.sessions.all, "list"],
    });
    emit("deleted", session.sessionId);
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : "删除会话失败";
  }
}
</script>

<template>
  <nav class="session-sidebar" aria-label="会话">
    <form class="sidebar-create" @submit.prevent="createSession">
      <label class="visually-hidden" for="new-session-name">新会话名称</label>
      <input
        id="new-session-name"
        v-model="newName"
        class="field"
        type="text"
        maxlength="160"
        placeholder="新会话名称"
        :disabled="workspaceId === undefined"
      />
      <button
        type="submit"
        class="btn"
        :disabled="workspaceId === undefined || newName.trim() === ''"
      >
        创建
      </button>
    </form>

    <label class="visually-hidden" for="session-search">搜索会话</label>
    <input
      id="session-search"
      v-model="search"
      class="field"
      type="search"
      placeholder="搜索会话"
      :disabled="workspaceId === undefined"
    />

    <p v-if="actionError" class="sidebar-error" role="alert">
      {{ actionError }}
    </p>

    <p v-if="workspaceId === undefined" class="sidebar-empty">
      选择一个工作区以查看会话。
    </p>
    <p v-else-if="listQuery.isPending.value" class="sidebar-empty">正在加载…</p>
    <p v-else-if="sessions.length === 0" class="sidebar-empty">
      没有匹配的会话。
    </p>

    <ul v-else class="session-list">
      <li v-for="session in sessions" :key="session.sessionId">
        <div
          class="session-row"
          :data-active="session.sessionId === activeSessionId"
        >
          <template v-if="renamingId === session.sessionId">
            <input
              v-model="renameValue"
              class="field"
              type="text"
              maxlength="160"
              aria-label="会话名称"
              @keydown.enter.prevent="submitRename(session)"
              @keydown.escape.prevent="renamingId = null"
            />
            <button
              type="button"
              class="btn btn-ghost"
              @click="submitRename(session)"
            >
              保存
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              @click="renamingId = null"
            >
              取消
            </button>
          </template>

          <template v-else-if="confirmingDeleteId === session.sessionId">
            <span class="confirm-text">删除「{{ session.name }}」？</span>
            <button
              type="button"
              class="btn btn-danger"
              @click="deleteSession(session)"
            >
              确认删除
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              @click="confirmingDeleteId = null"
            >
              取消
            </button>
          </template>

          <template v-else>
            <button
              type="button"
              class="session-select"
              :aria-current="
                session.sessionId === activeSessionId ? 'page' : undefined
              "
              @click="emit('select', session.sessionId)"
            >
              <span class="session-name">{{ session.name }}</span>
              <span
                v-if="availabilityLabel(session) !== ''"
                class="badge"
                :data-tone="
                  session.availability === 'quarantined' ? 'danger' : 'warning'
                "
              >
                {{ availabilityLabel(session) }}
              </span>
            </button>
            <button
              type="button"
              class="btn btn-ghost row-action"
              :aria-label="`重命名 ${session.name}`"
              @click="startRename(session)"
            >
              重命名
            </button>
            <button
              type="button"
              class="btn btn-ghost row-action"
              :aria-label="`删除 ${session.name}`"
              @click="confirmingDeleteId = session.sessionId"
            >
              删除
            </button>
          </template>
        </div>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.session-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  height: 100%;
}

.sidebar-create {
  display: flex;
  gap: var(--space-2);
}

.sidebar-error {
  color: var(--color-danger);
  font-size: var(--text-sm);
  margin: 0;
}

.sidebar-empty {
  color: var(--color-foreground-muted);
  font-size: var(--text-sm);
  padding: var(--space-3) 0;
}

.session-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.session-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border-radius: var(--radius-control);
}

.session-row[data-active="true"] {
  background: var(--color-surface-muted);
}

.session-select {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--target-min);
  padding: 0 var(--space-2);
  border: 0;
  background: transparent;
  text-align: left;
  border-radius: var(--radius-control);
}

.session-select:hover {
  background: var(--color-surface-muted);
}

.session-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-action {
  min-height: var(--target-min);
  min-width: var(--target-min);
  padding: 0 var(--space-2);
  font-size: var(--text-xs);
}

.confirm-text {
  flex: 1;
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
