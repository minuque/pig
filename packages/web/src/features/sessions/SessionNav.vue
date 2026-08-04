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
    <p v-if="loadingSessions" role="status">正在加载 Sessions…</p>
    <div v-else-if="sessionError" class="notice error" role="alert">
      <p>{{ sessionError }}</p>
      <button type="button" @click="emit('retry')">重试</button>
    </div>
    <p v-else-if="workspace && sessions.length === 0" class="notice">
      暂无 Session。使用“创建 Session”开始。
    </p>
    <nav v-else aria-label="Session 列表">
      <RouterLink
        v-for="session in sessions"
        :key="session.id"
        :to="`/sessions/${session.id}`"
        :class="['session-card', { unavailable: session.status === 'unavailable' }]"
        @click="emit('navigate')"
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
    </nav>
    <button v-if="nextCursor" class="secondary" type="button" @click="emit('load-more')">
      加载更多
    </button>
  </section>
</template>

<script setup lang="ts">
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
}>();

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
