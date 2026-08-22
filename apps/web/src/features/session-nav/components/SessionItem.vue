<template>
  <div class="session-item">
    <form v-if="renaming" class="rename-form" @submit.prevent="commitRename">
      <input
        ref="nameInput"
        v-model="draft"
        class="rename-input"
        aria-label="会话名称"
        @keydown.escape.prevent="renaming = false"
        @blur="commitRename"
      />
    </form>
    <RouterLink
      v-else
      :to="{ name: 'session', params: { sessionId: session.id } }"
      class="session-card"
      :class="{ active }"
      :aria-current="active ? 'page' : undefined"
      :aria-label="
        workspaceTitle ? `${sessionTitle(session)}, ${workspaceTitle}` : sessionTitle(session)
      "
      @click="onNavigate"
    >
      <div class="card-line">
        <Folder :size="16" class="workspace-mark" aria-hidden="true" />
        <span v-if="workspaceTitle" class="workspace-title">{{ workspaceTitle }}</span>
        <span v-else class="card-spacer"></span>
        <span class="session-meta">
          <span v-if="running" class="session-status">运行中</span>
          <template v-else-if="sessionRecency(session)">
            <Clock :size="12" class="session-clock" aria-hidden="true" />
            <time class="session-time" :datetime="new Date(sessionRecency(session)).toISOString()">
              {{ formatRelativeTime(sessionRecency(session)) }}
            </time>
          </template>
        </span>
      </div>
      <div class="card-title-line">
        <span class="title">{{ sessionTitle(session) }}</span>
      </div>
      <div class="card-line card-foot">
        <span class="card-count">{{ messageCount == null ? "" : `${messageCount} 条` }}</span>
        <span class="card-model">
          <span class="card-model-name">{{ modelLabel }}</span>
          <VendorMark v-if="modelProvider" :vendor="modelProvider" :size="13" />
        </span>
      </div>
    </RouterLink>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button
          class="icon-button session-kebab"
          type="button"
          :aria-label="`操作会话：${sessionTitle(session)}`"
          @click.stop
        >
          <MoreHorizontal :size="16" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="select-none" :side-offset="6">
        <DropdownMenuItem @select="startRename">
          <Pencil :size="14" aria-hidden="true" />
          重命名
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" @select="onDelete">
          <Trash2 :size="14" aria-hidden="true" />
          删除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { Clock, Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-vue-next";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { formatRelativeTime, sessionRecency, sessionTitle } from "@features/session-nav/format.js";
import VendorMark from "@features/chat-input/components/VendorMark.vue";

const props = withDefaults(
  defineProps<{
    session: SessionMetadata;
    workspaceTitle?: string;
    active?: boolean;
    running?: boolean;
    messageCount?: number | null;
    modelLabel?: string;
    modelProvider?: string;
  }>(),
  {
    workspaceTitle: "",
    messageCount: null,
    modelLabel: "",
    modelProvider: "",
  },
);

const emit = defineEmits<{
  navigate: [];
  rename: [id: string, name: string];
  delete: [id: string];
}>();

const renaming = ref(false);
const draft = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

function onNavigate() {
  emit("navigate");
}
function startRename() {
  draft.value = sessionTitle(props.session);
  renaming.value = true;
  void nextTick(() => {
    nameInput.value?.focus();
    nameInput.value?.select();
  });
}
function commitRename() {
  if (!renaming.value) return;
  renaming.value = false;
  const name = draft.value.trim();
  if (!name || name === sessionTitle(props.session)) return;
  emit("rename", props.session.id, name);
}
function onDelete() {
  if (confirm(`删除会话「${sessionTitle(props.session)}」？此操作不可恢复。`)) {
    emit("delete", props.session.id);
  }
}
</script>

<style scoped>
.session-item {
  position: relative;
  width: 100%;
  min-width: 0;
}
.session-card,
.rename-form {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-width: 0;
  height: 4.875rem;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
}
.session-item:hover .session-card,
.session-item:has(.session-kebab[aria-expanded="true"]) .session-card {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.session-card.active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.workspace-mark {
  flex: none;
  color: var(--ink-muted);
  transition: color var(--duration-fast) var(--ease-smooth);
}
.card-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 20px;
}
.workspace-title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-spacer {
  flex: 1;
  min-width: 0;
}
.card-title-line {
  display: flex;
  min-width: 0;
  margin-top: 4px;
}
.card-foot {
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}
.card-count,
.card-model {
  min-width: 0;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  white-space: nowrap;
}
.card-count {
  flex: none;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-model {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex: none;
  max-width: 60%;
}
.card-model :deep(.vendor-mark) {
  display: block;
  line-height: 0;
  filter: grayscale(1);
  opacity: 0.65;
  transition:
    filter var(--duration-fast) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}
.card-model :deep(.vendor-mark-mono) {
  color: var(--ink-muted);
  filter: none;
  opacity: 1;
}
.card-model-name {
  color: var(--ink-muted);
  min-width: 0;
  overflow: hidden;
  line-height: 1;
  text-overflow: ellipsis;
  transition: color var(--duration-fast) var(--ease-smooth);
}
.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-smooth);
}
.session-item:hover .title,
.session-item:has(.session-kebab[aria-expanded="true"]) .title,
.session-card.active .title {
  font-weight: var(--font-weight-medium);
}
.session-item:hover .title,
.session-item:hover .workspace-mark,
.session-item:hover .card-model-name,
.session-item:has(.session-kebab[aria-expanded="true"]) .title,
.session-item:has(.session-kebab[aria-expanded="true"]) .workspace-mark,
.session-item:has(.session-kebab[aria-expanded="true"]) .card-model-name,
.session-card.active .title,
.session-card.active .card-model-name {
  color: var(--ink);
}
.session-item:hover .card-model :deep(.vendor-mark),
.session-item:has(.session-kebab[aria-expanded="true"]) .card-model :deep(.vendor-mark),
.session-card.active .card-model :deep(.vendor-mark) {
  filter: none;
  opacity: 1;
  color: var(--ink);
}
.session-card.active .workspace-mark {
  color: var(--primary);
}
.session-meta {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}
.session-clock {
  flex: none;
  color: var(--ink-faint);
}
.session-time {
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-regular);
  line-height: 16px;
  white-space: nowrap;
}
.session-status {
  color: var(--accent-orange-deep);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-semibold);
}
.rename-form {
  justify-content: center;
}
.rename-input {
  width: 100%;
  min-height: 24px;
  padding: 0 6px;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  user-select: text;
}
.session-kebab {
  position: absolute;
  z-index: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--on-primary);
  opacity: 0;
}
.session-item .session-kebab {
  top: 2px;
  right: 2px;
}
.session-item:hover .session-meta,
.session-item:has(.session-kebab[aria-expanded="true"]) .session-meta {
  opacity: 0;
}
.session-item:hover > .session-kebab,
.session-kebab:focus-visible,
.session-kebab[aria-expanded="true"] {
  opacity: 1;
}
</style>
