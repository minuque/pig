<template>
  <div class="session-item" :class="{ 'is-menu-open': menuOpen }">
    <button
      v-if="!renaming"
      class="pin-toggle press-scale"
      type="button"
      :title="pinned ? '取消置顶' : '置顶'"
      :aria-label="pinned ? '取消置顶' : '置顶'"
      :aria-pressed="pinned"
      @click.stop="emit('togglePinned', session.id)"
    >
      <PinOff v-if="pinned" class="size-icon" />
      <Pin v-else class="size-icon" />
    </button>

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
            <span class="pin-slot" aria-hidden="true"></span>

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

            <span v-if="!renaming" class="trail-slot">
              <span v-if="streaming" class="session-spin" :aria-label="stateLabel">
                <Spinner :size="12" />
              </span>

              <time
                v-else-if="session.updatedAt"
                class="session-time"
                :class="{ 'has-state': stateDot }"
                :datetime="new Date(session.updatedAt).toISOString()"
                :aria-label="stateDot ? stateLabel : undefined"
              >
                <span v-if="stateDot" class="state-dot" :class="state"></span>
                <span class="time-text">{{ relativeTime }}</span>
              </time>

              <button
                class="more-toggle press-scale"
                type="button"
                title="更多"
                aria-label="更多"
                aria-haspopup="menu"
                :aria-expanded="menuOpen"
                @click.prevent.stop="openSessionMenu"
                @contextmenu.prevent.stop="openSessionMenu"
              >
                <Ellipsis class="size-icon" />
              </button>
            </span>
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

    <SessionItemDelete v-model:open="deleteOpen" :title="session.title" @confirm="confirmDelete" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from "vue"
import { RouterLink } from "vue-router"
import { Ellipsis, Pencil, Pin, PinOff, Trash2 } from "@lucide/vue"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { useNav } from "@features/session-nav/index.js"
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { Spinner } from "@components/ui/spinner/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
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

const { openSession } = useNav()

const renaming = ref(false)

const draft = ref("")

const nameInput = ref<HTMLInputElement | null>(null)

const menuOpen = ref(false)

const deleteOpen = shallowRef(false)

const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))

const streaming = computed(() => props.state === "running" && !renaming.value)

const stateDot = computed(
  () => (props.state === "unread" || props.state === "error") && !renaming.value,
)

const stateLabel = computed(() => {
  if (props.state === "running") return "运行中"

  if (props.state === "unread") return "运行完成但未打开"

  if (props.state === "error") return "运行失败"
  return undefined
})

function onMenuOpenChange(open: boolean) {
  menuOpen.value = open
}

function isModifiedSessionClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function onCardClick(event: MouseEvent) {
  if (menuOpen.value || renaming.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit("navigate")

  if (isModifiedSessionClick(event)) return
  event.preventDefault()
  openSession(props.session.id)
}

function openContextMenuAt(target: HTMLElement, clientX: number, clientY: number) {
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      view: window,
    }),
  )
}

function openSessionMenu(event: MouseEvent) {
  const item = (event.currentTarget as HTMLElement).closest(".session-item")
  const card = item?.querySelector(".session-card")

  if (!(card instanceof HTMLElement)) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  openContextMenuAt(card, rect.left + rect.width / 2, rect.bottom)
}

function onCardKeydown(event: KeyboardEvent) {
  if (event.key !== "F10" || !event.shiftKey) return
  event.preventDefault()
  const el = event.currentTarget

  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  openContextMenuAt(el, rect.left + 8, rect.top + 8)
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
  width: 100%;
  height: var(--size-nav-rail);
  min-width: 0;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  line-height: 0;
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
  gap: var(--spacing-xxs);
  min-width: 0;
  width: 100%;
  height: 100%;
  line-height: 0;
}

.pin-slot {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.pin-toggle {
  position: absolute;
  z-index: 1;
  inset-inline-start: var(--spacing-xs);
  inset-block: 0;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  margin-block: auto;
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}

.session-item:hover .pin-toggle,
.pin-toggle:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

.pin-toggle:hover,
.pin-toggle:focus-visible {
  color: var(--ink);
}

.trail-slot {
  display: grid;
  flex: none;
  align-items: center;
  justify-items: end;
  min-width: var(--size-icon);
  min-height: var(--size-icon);
}

.session-spin,
.session-time,
.more-toggle {
  grid-area: 1 / 1;
}

.more-toggle {
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
  padding: 0;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-item:hover .more-toggle,
.session-item:focus-within .more-toggle,
.more-toggle:focus-visible,
.session-item.is-menu-open .more-toggle {
  opacity: 1;
  pointer-events: auto;
}

.more-toggle:hover,
.more-toggle:focus-visible {
  color: var(--ink);
}

.state-dot {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: 7px;
  height: 7px;
  margin-block: auto;
  border-radius: var(--radius-full);
  pointer-events: none;
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

.session-spin {
  display: flex;
  align-items: center;
  color: var(--ink-muted);
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-time {
  position: relative;
  display: flex;
  align-items: center;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
  text-align: end;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-time.has-state .time-text {
  visibility: hidden;
}

.session-item:hover .session-time,
.session-item:hover .session-spin,
.session-item:focus-within .session-time,
.session-item:focus-within .session-spin,
.session-item.is-menu-open .session-time,
.session-item.is-menu-open .session-spin {
  opacity: 0;
  pointer-events: none;
}

@media (hover: none) {
  .more-toggle {
    opacity: 1;
    pointer-events: auto;
  }

  .session-time,
  .session-spin {
    opacity: 0;
    pointer-events: none;
  }
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
