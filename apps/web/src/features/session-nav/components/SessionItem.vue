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
      @click="emit('navigate')"
    >
      <span class="t">{{ sessionTitle(session) }}</span>
      <span class="session-meta">
        <span v-if="running" class="session-status" title="运行中">运行中</span>
        <time
          v-else-if="sessionRecency(session)"
          class="session-time"
          :datetime="new Date(sessionRecency(session)).toISOString()"
        >
          {{ formatRelativeTime(sessionRecency(session)) }}
        </time>
      </span>
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-vue-next";
import type { SessionMetadata } from "@earendil-works/pi-protocol";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import { formatRelativeTime, sessionRecency, sessionTitle } from "@features/session-nav/types.js";

const props = defineProps<{
  session: SessionMetadata;
  active?: boolean;
  running?: boolean;
}>();

const emit = defineEmits<{
  navigate: [];
  rename: [id: string, name: string];
  delete: [id: string];
}>();

const renaming = ref(false);
const draft = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

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
  padding: 4px 1px 4px 22px;
  border-radius: 8px;
}
.session-card,
.rename-form {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: var(--nav-row, 28px);
  padding: 3px 8px;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  text-decoration: none;
}
.session-item:hover,
.session-item:has(.session-kebab[aria-expanded="true"]) {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}
.session-item:has(.session-card.active) {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}
.session-card .t {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: 13px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.session-card.active .t {
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
  font-size: 11px;
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
  top: 50%;
  right: 2px;
  z-index: 1;
  width: var(--size-nav-action);
  min-height: var(--size-nav-action);
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ink-faint);
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity var(--duration-fast) var(--ease-smooth);
}
.session-kebab:active {
  transform: translateY(-50%) scale(0.98);
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
