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
            dragging: tab.id === dragState?.id,
            'menu-open': menuOpenId === tab.id,
          }"
          :data-id="tab.id"
          :aria-selected="tab.id === activeId"
          :title="tab.title"
          :style="dragStyle(tab)"
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
                <GripVerticalIcon v-if="tab.id === dragState?.id" />

                <LoaderIcon
                  v-else-if="stateOf(tab.id) === 'running'"
                  class="animate-spin motion-reduce:animate-none"
                />

                <DangerCircleIcon v-else-if="stateOf(tab.id) === 'error'" />
                <VendorMark v-else-if="vendorOf(tab.id)" :vendor="vendorOf(tab.id)" :size="14" />
                <StarsMinimalisticIcon v-else />
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
            <CloseIcon />
          </button>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent class="select-none">
        <ContextMenuItem @select="emit('togglePinned', tab.id)">
          <PinBoldIcon v-if="pinned(tab.id)" />
          <PinIcon v-else />
          {{ pinned(tab.id) ? t("session.unpin") : t("session.pin") }}
        </ContextMenuItem>

        <ContextMenuItem @select="startRename(tab.id)">
          <PenIcon />
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
          <TrashBinMinimalisticIcon />
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
  CloseIcon,
  DangerCircleIcon,
  GripVerticalIcon,
  LoaderIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  StarsMinimalisticIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"
import {
  sessionTabsInCloseScope,
  type SessionTab,
} from "@features/session-workbench/lib/session-tabs.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import VendorMark from "@features/composer/components/VendorMark.vue"
import type { SidebarSessionState } from "@features/session-nav/type.js"

const props = defineProps<{
  tabs: readonly SessionTab[]
  activeId: string | undefined
  stateOf: (id: string) => SidebarSessionState | undefined
  pinned: (id: string) => boolean
  vendorOf: (id: string) => string | undefined
}>()
const emit = defineEmits<{
  select: [id: string]
  move: [draggedId: string, overId?: string]
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
const dragState = shallowRef<{
  id: string
  pointerId: number
  node: HTMLElement
  startX: number
  startLeft: number
  lastX: number
  translate: number
  moved: boolean
}>()
const frozenWidth = ref<number | null>(null)
const renamingId = ref<string>()
const renameDraft = ref("")
const deleteOpen = shallowRef(false)
const deleteId = ref<string>()
const deleteTitle = computed(() => props.tabs.find((tab) => tab.id === deleteId.value)?.title ?? "")
const menuOpenId = ref<string>()
const DRAG_DISTANCE = 6

function ids(): string[] {
  return props.tabs.map((tab) => tab.id)
}

function dragStyle(tab: SessionTab) {
  if (tab.id === dragState.value?.id) return undefined

  if (frozenWidth.value === null) return undefined
  return { flexBasis: `${frozenWidth.value}px` }
}

function scopeCount(id: string, scope: "left" | "right" | "others"): number {
  return sessionTabsInCloseScope(ids(), id, scope).length
}

function hasScope(id: string): boolean {
  return ids().length > 1
}

function cleanupDrag(): void {
  if (!dragState.value) return
  window.removeEventListener("pointermove", onDragMove)
  window.removeEventListener("pointerup", onDragEnd)
  window.removeEventListener("pointercancel", onDragEnd)
  dragState.value.node.style.removeProperty("transform")
  dragState.value = undefined
}

/** 把被拖标签按指针位置重新定位：按当前基准位置（排除了已应用位移）反算 translate。 */
function positionDragged(): void {
  const state = dragState.value

  if (!state) return
  const desired = state.startLeft + (state.lastX - state.startX)
  const base = state.node.getBoundingClientRect().left - state.translate

  state.translate = desired - base
  state.node.style.transform = `translateX(${state.translate}px)`
}

/** 重排后校正被拖标签并让其余标签平滑换位；必须等 DOM 落下再测，否则读到旧布局。 */
function commitMove(overId: string | undefined): void {
  const draggedId = dragState.value?.id
  const before = new Map(
    (tabNodes.value ?? []).map((node) => [
      node.dataset.id ?? "",
      node.getBoundingClientRect().left,
    ]),
  )

  emit("move", draggedId ?? "", overId)

  requestAnimationFrame(() => {
    positionDragged()

    const still = matchMedia("(prefers-reduced-motion: reduce)").matches

    for (const node of tabNodes.value ?? []) {
      const id = node.dataset.id ?? ""
      const delta = (before.get(id) ?? 0) - node.getBoundingClientRect().left

      if (id === draggedId || delta === 0 || still) continue
      node.animate([{ transform: `translateX(${delta}px)` }, { transform: "none" }], {
        duration: 180,
        easing: "ease-out",
      })
    }
  })
}

function onDragMove(move: PointerEvent): void {
  const state = dragState.value

  if (!state || move.pointerId !== state.pointerId) return

  if (!state.moved && Math.abs(move.clientX - state.startX) < DRAG_DISTANCE) return
  state.moved = true
  state.lastX = move.clientX
  positionDragged()
  const over = tabBeforeAt(move.clientX)

  commitMove(over)
}

function onDragEnd(up: PointerEvent): void {
  const state = dragState.value

  if (!state || up.pointerId !== state.pointerId) return
  const moved = state.moved
  cleanupDrag()

  if (!moved) emit("select", state.id)
}

function onPointerDown(id: string, event: PointerEvent): void {
  if (event.button !== 0 || event.ctrlKey) return
  const node = event.currentTarget

  if (!(node instanceof HTMLElement)) return
  cleanupDrag()
  dragState.value = {
    id,
    pointerId: event.pointerId,
    node,
    startX: event.clientX,
    startLeft: node.getBoundingClientRect().left,
    lastX: event.clientX,
    translate: 0,
    moved: false,
  }
  window.addEventListener("pointermove", onDragMove)
  window.addEventListener("pointerup", onDragEnd)
  window.addEventListener("pointercancel", onDragEnd)
}

/** 指针所在的插入目标：只看未被拖动的标签中点；越过末尾返回 undefined（插到队尾）。 */
function tabBeforeAt(clientX: number): string | undefined {
  for (const node of tabNodes.value ?? []) {
    const id = node.dataset.id ?? ""

    if (id === dragState.value?.id) continue
    const box = node.getBoundingClientRect()

    if (clientX < box.left + box.width / 2) return id
  }
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

.session-tabs:has(.session-tab.dragging) .session-tab:not(.dragging) {
  transition: transform var(--duration-fast) var(--ease-smooth);
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
  background: var(--composer-bg);
  color: var(--ink);
  box-shadow: var(--shadow-card);
  cursor: grabbing;
  transition: none;
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
