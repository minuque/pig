<template>
  <div
    ref="strip"
    class="session-tabs"
    role="tablist"
    :aria-label="t('session.openTabs')"
    @wheel.passive="onWheel"
    @pointerleave="frozenWidth = null"
  >
    <ContextMenu
      v-for="tab in tabs"
      :key="tab.id"
      :modal="false"
      @update:open="(open) => onMenuOpen(tab.id, open)"
    >
      <ContextMenuTrigger as-child>
        <div
          ref="tabNodes"
          class="session-tab"
          :class="{
            active: tab.id === activeId,
            dragging: tab.id === draggingId,
            'menu-open': menuOpenId === tab.id,
          }"
          :aria-selected="tab.id === activeId"
          :title="tab.title"
          :style="frozenWidth === null ? undefined : { width: `${frozenWidth}px` }"
          @pointerdown="onPointerDown(tab.id, $event)"
          @auxclick="onMiddleClick(tab.id, $event)"
        >
          <button
            class="tab-select"
            type="button"
            role="tab"
            :tabindex="tab.id === activeId ? 0 : -1"
            :aria-selected="tab.id === activeId"
            @keydown="onTabKeydown(tab.id, $event)"
            @dblclick="startRename(tab.id)"
          >
            <input
              v-if="renamingId === tab.id"
              ref="nameInput"
              v-model="renameDraft"
              class="rename-input"
              :aria-label="t('session.rename')"
              @click.stop
              @pointerdown.stop
              @keydown.enter.prevent="commitRename"
              @keydown.escape.prevent="cancelRename"
              @blur="commitRename"
            />

            <template v-else>
              <span class="tab-glyph">
                <IconLoading
                  v-if="stateOf(tab.id) === 'running'"
                  class="animate-spin motion-reduce:animate-none"
                />

                <IconAlert v-else-if="stateOf(tab.id) === 'error'" />
                <IconSparkle v-else />
              </span>

              <span class="tab-title">{{ tab.title }}</span>
            </template>
          </button>

          <button
            class="tab-close"
            type="button"
            :tabindex="-1"
            :aria-label="t('session.closeTab', { title: tab.title })"
            @pointerdown.stop
            @click.stop="close(tab.id)"
          >
            <IconCross />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent class="select-none">
        <ContextMenuItem @select="emit('togglePinned', tab.id)">
          <IconPinOff v-if="pinned(tab.id)" />
          <IconPin v-else />
          {{ pinned(tab.id) ? t("session.unpin") : t("session.pin") }}
        </ContextMenuItem>

        <ContextMenuItem @select="startRename(tab.id)">
          <IconPencil />
          {{ t("session.rename") }}
        </ContextMenuItem>

        <template v-if="hasScope(tab.id)">
          <ContextMenuSeparator />

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'left') > 0"
            @select="emit('closeScope', tab.id, 'left')"
          >
            {{ t("session.closeLeftTabs") }}
          </ContextMenuItem>

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'right') > 0"
            @select="emit('closeScope', tab.id, 'right')"
          >
            {{ t("session.closeRightTabs") }}
          </ContextMenuItem>

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'others') > 0"
            @select="emit('closeScope', tab.id, 'others')"
          >
            {{ t("session.closeOtherTabs") }}
          </ContextMenuItem>
        </template>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" @select="onDelete(tab.id)">
          <IconTrash />
          {{ t("session.deleteTitle") }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

    <SessionItemDelete v-model:open="deleteOpen" :title="deleteTitle" @confirm="confirmDelete" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import {
  IconAlert,
  IconCross,
  IconLoading,
  IconPencil,
  IconPin,
  IconPinOff,
  IconSparkle,
  IconTrash,
} from "@components/icons/index.js"
import {
  sessionTabsInCloseScope,
  type SessionTab,
} from "@features/session-workbench/lib/session-tabs.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import type { SidebarSessionState } from "@features/session-nav/type.js"

const props = defineProps<{
  tabs: readonly SessionTab[]
  activeId: string | undefined
  stateOf: (id: string) => SidebarSessionState | undefined
  pinned: (id: string) => boolean
}>()
const emit = defineEmits<{
  select: [id: string]
  move: [draggedId: string, overId: string]
  close: [id: string]
  closeScope: [id: string, scope: "left" | "right" | "others"]
  rename: [id: string, name: string]
  togglePinned: [id: string]
  delete: [id: string]
}>()
const { t } = useI18n()
const strip = useTemplateRef("strip")
const tabNodes = useTemplateRef<HTMLElement[]>("tabNodes")
const nameInput = useTemplateRef<HTMLInputElement>("nameInput")
const draggingId = ref<string>()
const frozenWidth = ref<number | null>(null)
const renamingId = ref<string>()
const renameDraft = ref("")
const deleteOpen = shallowRef(false)
const deleteId = ref<string>()
const deleteTitle = computed(() => props.tabs.find((tab) => tab.id === deleteId.value)?.title ?? "")
const menuOpenId = ref<string>()
const DRAG_DISTANCE = 6
let dragListeners:
  { pointerId: number; onMove: (e: PointerEvent) => void; onEnd: () => void } | undefined

function ids(): string[] {
  return props.tabs.map((tab) => tab.id)
}

function scopeCount(id: string, scope: "left" | "right" | "others"): number {
  return sessionTabsInCloseScope(ids(), id, scope).length
}

function hasScope(id: string): boolean {
  return ids().length > 1
}

function cleanupDrag(): void {
  if (!dragListeners) return
  window.removeEventListener("pointermove", dragListeners.onMove)
  window.removeEventListener("pointerup", dragListeners.onEnd)
  window.removeEventListener("pointercancel", dragListeners.onEnd)
  dragListeners = undefined
  draggingId.value = undefined
}

function onPointerDown(id: string, event: PointerEvent): void {
  if (event.button !== 0 || event.ctrlKey) return

  const startX = event.clientX
  const pointerId = event.pointerId
  let moved = false
  const onMove = (move: PointerEvent) => {
    if (move.pointerId !== pointerId) return

    if (!moved && Math.abs(move.clientX - startX) < DRAG_DISTANCE) return
    moved = true
    draggingId.value = id
    const over = tabAt(move.clientX)

    if (over && over !== id) emit("move", id, over)
  }
  const onEnd = () => {
    cleanupDrag()

    if (!moved) emit("select", id)
  }

  cleanupDrag()
  dragListeners = { pointerId, onMove, onEnd }
  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onEnd)
  window.addEventListener("pointercancel", onEnd)
}

function tabAt(clientX: number): string | undefined {
  const nodes = tabNodes.value

  if (!nodes) return

  for (const [index, node] of nodes.entries()) {
    const box = node.getBoundingClientRect()

    if (clientX < box.left + box.width / 2) return props.tabs[index]?.id
  }

  return props.tabs.at(-1)?.id
}

function close(id: string): void {
  // 悬停时冻结其余标签宽度，防 flex 重排跳动；取被关标签自己宽度对齐收缩节奏
  const nodes = tabNodes.value
  const tab = nodes?.[props.tabs.findIndex((item) => item.id === id)]

  if (tab && strip.value?.matches(":hover")) {
    frozenWidth.value = tab.getBoundingClientRect().width
  }

  emit("close", id)
}

function onMiddleClick(id: string, event: MouseEvent): void {
  if (event.button !== 1) return
  event.preventDefault()
  close(id)
}

function startRename(id: string): void {
  if (renamingId.value) return
  renameDraft.value = props.tabs.find((tab) => tab.id === id)?.title ?? ""
  renamingId.value = id
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function cancelRename(): void {
  renamingId.value = undefined
}

function commitRename(): void {
  const id = renamingId.value

  if (!id) return
  renamingId.value = undefined
  const name = renameDraft.value.trim()

  if (!name || name === props.tabs.find((tab) => tab.id === id)?.title) return
  emit("rename", id, name)
}

function onDelete(id: string): void {
  deleteId.value = id
  deleteOpen.value = true
}

function confirmDelete(): void {
  deleteOpen.value = false

  if (deleteId.value) emit("delete", deleteId.value)
  deleteId.value = undefined
}

function onMenuOpen(id: string, open: boolean): void {
  menuOpenId.value = open ? id : undefined

  if (open && id !== props.activeId) emit("select", id)
}

function onTabKeydown(id: string, event: KeyboardEvent): void {
  const current = ids()
  const index = current.indexOf(id)

  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault()
    const step = event.key === "ArrowRight" ? 1 : -1
    const next =
      current[index + step] ?? current[event.key === "ArrowRight" ? 0 : current.length - 1]

    if (next && next !== id) emit("select", next)
  }
}

function onWheel(event: WheelEvent): void {
  const node = strip.value

  if (!node || event.deltaX !== 0 || event.deltaY === 0) return
  node.scrollLeft += event.deltaY
}

onBeforeUnmount(cleanupDrag)

watch(
  () => props.activeId,
  async (id) => {
    if (!id) return
    await nextTick()
    strip.value
      ?.querySelector<HTMLElement>(".session-tab.active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" })
  },
)
</script>

<style scoped>
.session-tabs {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.session-tabs::-webkit-scrollbar {
  display: none;
}

.session-tab {
  position: relative;
  display: flex;
  flex: 0 1 18em;
  align-items: center;
  width: 18em;
  min-width: 9em;
  height: calc(var(--size-nav-rail) + var(--spacing-xxs));
  border-radius: var(--radius-md);
  color: var(--ink-muted);
  cursor: grab;
}

.session-tab:hover {
  background: var(--hover-quiet);
  color: var(--ink);
}

.session-tab.active {
  flex-shrink: 0;
  background: var(--hover-tint);
  color: var(--ink);
  cursor: default;
}

.session-tab.dragging {
  z-index: 1;
  cursor: grabbing;
}

.session-tab + .session-tab::before {
  content: "";
  position: absolute;
  top: 50%;
  left: calc(var(--spacing-xxs) / -2 - 0.5px);
  width: var(--border-width);
  height: 1.25rem;
  translate: 0 -50%;
  background: var(--border);
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-tab:is(.active, :hover)::before,
.session-tab:is(.active, :hover) + .session-tab::before {
  opacity: 0;
}

.tab-select {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
  height: 100%;
  padding-inline: var(--spacing-sm) calc(var(--size-nav-rail) + var(--spacing-xxs));
  border-radius: inherit;
  text-align: start;
}

.session-tab:not(.active):not(:hover):not(:focus-within) .tab-select {
  padding-inline-end: var(--spacing-sm);
}

.tab-glyph {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-icon);
  height: var(--size-icon);
  opacity: 0.7;
}

.session-tab.active .tab-glyph,
.session-tab:hover .tab-glyph {
  opacity: 1;
}

.tab-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
  white-space: nowrap;
  mask-image: linear-gradient(to right, var(--ink) calc(100% - 1rem), transparent);
}

.tab-close {
  position: absolute;
  top: 50%;
  right: var(--spacing-xxs);
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
  translate: 0 -50%;
  border-radius: var(--radius-sm);
  color: var(--ink-muted);
  opacity: 0;
}

.session-tab.menu-open .tab-close,
.session-tab.active .tab-close,
.session-tab:hover .tab-close,
.session-tab:focus-within .tab-close {
  opacity: 1;
}

.tab-close:hover,
.tab-close:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
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

@media (pointer: coarse) {
  .session-tab:not(.active) .tab-close {
    pointer-events: none;
  }
}
</style>
