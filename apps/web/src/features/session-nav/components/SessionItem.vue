<template>
  <div class="session-item" :class="variant">
    <form v-if="renaming" class="rename-form" :class="variant" @submit.prevent="commitRename">
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
      :id="resultId || undefined"
      :to="{ name: 'session', params: { sessionId: session.id } }"
      class="session-card"
      :class="[variant, { active, highlighted }]"
      :aria-current="active ? 'page' : undefined"
      :aria-selected="highlighted || undefined"
      :aria-label="
        workspaceTitle ? `${sessionTitle(session)}, ${workspaceTitle}` : sessionTitle(session)
      "
      @click="onNavigate"
    >
      <template v-if="variant === 'slim'">
        <Folder :size="16" class="workspace-mark" aria-hidden="true" />
        <span class="title">{{ sessionTitle(session) }}</span>
        <span class="session-meta">
          <span v-if="running" class="session-status">运行中</span>
          <time
            v-else-if="sessionRecency(session)"
            class="session-time"
            :datetime="new Date(sessionRecency(session)).toISOString()"
          >
            {{ formatRelativeTime(sessionRecency(session)) }}
          </time>
        </span>
      </template>
      <template v-else>
        <div class="card-line">
          <Folder :size="16" class="workspace-mark" aria-hidden="true" />
          <span v-if="workspaceTitle" class="workspace-title">{{ workspaceTitle }}</span>
          <span v-else class="card-spacer"></span>
          <span class="session-meta">
            <span v-if="running" class="session-status">运行中</span>
            <time
              v-else-if="sessionRecency(session)"
              class="session-time"
              :datetime="new Date(sessionRecency(session)).toISOString()"
            >
              {{ formatRelativeTime(sessionRecency(session)) }}
            </time>
          </span>
        </div>
        <div class="card-title-line">
          <span class="title">{{ sessionTitle(session) }}</span>
        </div>
        <div class="card-line card-foot">
          <span class="card-spacer"></span>
        </div>
      </template>
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
      <DropdownMenuContent align="start" :side-offset="6">
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
import { Folder, MoreHorizontal, Pencil, Trash2 } from "lucide-vue-next";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { formatRelativeTime, sessionRecency, sessionTitle } from "@features/session-nav/types.js";

const props = withDefaults(
  defineProps<{
    session: SessionMetadata;
    workspaceTitle?: string;
    active?: boolean;
    running?: boolean;
    variant?: "card" | "slim";
    highlighted?: boolean;
    resultId?: string;
  }>(),
  {
    workspaceTitle: "",
    variant: "card",
    highlighted: false,
    resultId: "",
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
  min-width: 0;
}
.session-card,
.rename-form {
  display: flex;
  min-width: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
}
.session-card.card,
.rename-form.card {
  flex-direction: column;
  height: 4.875rem;
  padding: 8px 10px;
  justify-content: flex-start;
}
.session-card.slim,
.rename-form.slim {
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 10px;
}
.session-item:hover .session-card,
.session-item:has(.session-kebab[aria-expanded="true"]) .session-card,
.session-card.highlighted {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.session-card.active {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.workspace-mark {
  flex: none;
  color: var(--ink-faint);
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
  margin-top: 2px;
}
.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-body-sm);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body-sm--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-card.slim .title {
  font-weight: var(--font-weight-regular);
  color: var(--ink-secondary);
}
.session-card.slim.active .title,
.session-card.slim.highlighted .title {
  color: var(--ink);
}
.session-card.active .title {
  font-weight: var(--font-weight-medium);
}
.session-meta {
  flex: none;
  display: inline-flex;
  align-items: center;
  transition: opacity var(--duration-fast) var(--ease-smooth);
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
.rename-form.card {
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
}
.session-kebab {
  position: absolute;
  z-index: 1;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  opacity: 0;
}
.session-item.card .session-kebab {
  top: 6px;
  right: 6px;
}
.session-item.slim .session-kebab {
  top: 50%;
  right: 2px;
  transform: translateY(-50%);
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
