<template>
  <div class="session-item">
    <ContextMenu :press-open-delay="500" @update:open="onMenuOpenChange">
      <ContextMenuTrigger as-child>
        <component
          :is="renaming ? 'div' : RouterLink"
          class="session-card"
          :class="{ active }"
          :to="renaming ? undefined : { name: 'session', params: { sessionId: session.id } }"
          @click="onCardClick"
          @keydown="onCardKeydown"
        >
          <div class="card-line card-head">
            <input
              v-if="renaming"
              ref="nameInput"
              v-model="draft"
              class="rename-input"
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.escape.prevent="cancelRename"
              @blur="commitRename"
            />
            <span v-else class="title">{{ session.title }}</span>
            <span class="session-meta">
              <span v-if="running || session.updatedAt" class="session-icon icon-swap">
                <Spinner :size="12" class="session-spinner" :data-visible="running" />
                <Clock
                  :size="12"
                  :stroke-width="1.5"
                  class="session-clock"
                  :data-visible="!running && Boolean(session.updatedAt)"
                />
              </span>
              <time
                v-if="!running && session.updatedAt"
                class="session-time"
                :datetime="new Date(session.updatedAt).toISOString()"
              >
                {{ relativeTime }}
              </time>
            </span>
          </div>
          <div class="card-line card-foot">
            <span v-if="grouping === 'updated'" class="card-project">
              <Folder :size="16" :stroke-width="1.5" class="workspace-mark" />
              <span v-if="workspaceTitle" class="workspace-title">{{ workspaceTitle }}</span>
            </span>
            <span v-else class="card-count">{{
              messageCount == null ? "" : `${messageCount} 条`
            }}</span>
            <span v-if="modelProvider" class="card-model">
              <VendorMark :vendor="modelProvider" :size="13" />
            </span>
          </div>
        </component>
      </ContextMenuTrigger>
      <ContextMenuContent class="select-none">
        <ContextMenuItem @select="startRename">
          <Pencil :size="14" />
          重命名
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" @select="deleteOpen = true">
          <Trash2 :size="14" />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <AlertDialog v-model:open="deleteOpen">
      <AlertDialogContent class="sm:max-w-[28rem]">
        <AlertDialogHeader>
          <AlertDialogTitle>删除会话</AlertDialogTitle>
          <AlertDialogDescription>
            确定删除“{{ session.title }}”吗？此操作不可恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction variant="destructive" @click="confirmDelete">
            删除会话
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue"
import { RouterLink } from "vue-router"
import { Clock, Folder, Pencil, Trash2 } from "lucide-vue-next"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { Spinner } from "@components/ui/spinner/index.js"
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import type { SidebarGrouping, SidebarSession } from "@features/session-nav/lib/session-list.js"
import VendorMark from "@features/chat-input/components/VendorMark.vue"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    workspaceTitle?: string
    active?: boolean
    running?: boolean
    grouping?: SidebarGrouping
    now: number
    messageCount?: number | null
    modelProvider?: string
  }>(),
  {
    workspaceTitle: "",
    grouping: "updated",
    messageCount: null,
    modelProvider: "",
  },
)

const emit = defineEmits<{
  navigate: []
  rename: [id: string, name: string]
  delete: [id: string]
}>()

const renaming = ref(false)
const draft = ref("")
const nameInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))

function onMenuOpenChange(open: boolean) {
  menuOpen.value = open
}
function onCardClick(event: MouseEvent) {
  if (menuOpen.value || renaming.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  emit("navigate")
}
function onCardKeydown(event: KeyboardEvent) {
  if (event.key !== "F10" || !event.shiftKey) return
  event.preventDefault()
  const el = event.currentTarget
  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  el.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + 8,
      clientY: rect.top + 8,
      view: window,
    }),
  )
}
function startRename() {
  draft.value = props.session.title
  renaming.value = true
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}
function cancelRename() {
  renaming.value = false
}
function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  const name = draft.value.trim()
  if (!name || name === props.session.title) return
  emit("rename", props.session.id, name)
}
function confirmDelete() {
  deleteOpen.value = false
  emit("delete", props.session.id)
}
</script>

<style scoped>
.session-item {
  position: relative;
  width: 100%;
  min-width: 0;
}
.session-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
}
.session-item:hover .session-card,
.session-card[data-state="open"] {
  background: var(--interaction-hover);
}
.session-card.active {
  background: var(--interaction-selected);
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
  height: 18px;
}
.card-head,
.card-foot {
  justify-content: space-between;
  gap: 8px;
}
.card-project {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
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
.card-count {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-model {
  display: inline-flex;
  flex: none;
  align-items: center;
}
.card-model :deep(.vendor-mark) {
  display: block;
  line-height: 0;
  filter: brightness(0.72);
  transition:
    filter var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}
.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-smooth);
}

.session-item:hover .title,
.session-item:hover .workspace-mark,
.session-card[data-state="open"] .title,
.session-card[data-state="open"] .workspace-mark,
.session-card.active .title {
  color: var(--ink);
}
.session-item:hover .card-model :deep(.vendor-mark),
.session-card[data-state="open"] .card-model :deep(.vendor-mark),
.session-card.active .card-model :deep(.vendor-mark) {
  filter: none;
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
}
.session-icon {
  width: 12px;
  height: 12px;
}
.session-clock,
.session-spinner {
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
.rename-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: var(--radius-xs);
  background: color-mix(in srgb, var(--ink) 10%, var(--surface));
  color: var(--ink);
  caret-color: var(--primary);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--primary);
  user-select: text;
}
.rename-input::selection {
  background: color-mix(in srgb, var(--primary) 35%, transparent);
  color: var(--ink);
}
</style>
