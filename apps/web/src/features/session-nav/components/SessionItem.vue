<template>
  <div class="session-item">
    <span v-if="state && !renaming" class="session-state" :aria-label="stateLabel">
      <Spinner v-if="state === 'running'" :size="12" />
      <span v-else class="state-dot" :class="state"></span>
    </span>

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
          <div class="card-line">
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
            <time
              v-if="session.updatedAt"
              class="session-time"
              :datetime="new Date(session.updatedAt).toISOString()"
            >
              {{ relativeTime }}
            </time>
          </div>
        </component>
      </ContextMenuTrigger>
      <ContextMenuContent class="select-none">
        <ContextMenuItem @select="emit('togglePinned', session.id)">
          <PinOff v-if="pinned" :size="14" />
          <Pin v-else :size="14" />
          {{ pinned ? "取消置顶" : "置顶" }}
        </ContextMenuItem>
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
import { Pencil, Pin, PinOff, Trash2 } from "@lucide/vue"
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
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { Spinner } from "@components/ui/spinner/index.js"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    state?: SidebarSessionState | undefined
    now: number
  }>(),
  {
    state: undefined,
  },
)

const emit = defineEmits<{
  navigate: []
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
}>()

const renaming = ref(false)
const draft = ref("")
const nameInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)

const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))
const stateLabel = computed(() => {
  if (props.state === "running") return "运行中"
  if (props.state === "unread") return "运行完成但未打开"
  if (props.state === "error") return "运行失败"
  return undefined
})

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
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  min-width: 0;
  padding-inline: var(--spacing-xxs) var(--spacing-xs);
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

.card-line {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  width: 100%;
}

.session-state {
  position: absolute;
  z-index: 1;
  inset-inline-start: calc(-1 * var(--size-icon-2xs));
  inset-block-start: calc(50% - var(--size-icon-2xs) / 2);
  display: grid;
  place-items: center;
  width: var(--size-icon-2xs);
  height: var(--size-icon-2xs);
  pointer-events: none;
}

.state-dot {
  width: 7px;
  height: 7px;
  border-radius: var(--radius-full);
}
.state-dot.unread {
  background: var(--info);
}
.state-dot.error {
  background: var(--danger);
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
.session-card[data-state="open"] .title,
.session-card.active .title {
  color: var(--ink);
}

.session-time {
  flex: none;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-regular);
  line-height: 16px;
  text-align: end;
  white-space: nowrap;
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  margin: 0;
  padding: 0 var(--spacing-xxs);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--interaction-hover);
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
  background: var(--selection-bg);
  color: var(--ink);
}
</style>
