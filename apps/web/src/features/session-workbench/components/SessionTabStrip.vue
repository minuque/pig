<template>
  <div
    ref="strip"
    class="session-tabs"
    role="tablist"
    aria-label="打开的会话"
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
          class="session-tab"
          :class="{ active: tab.id === activeId, dragging: tab.id === draggingId }"
          role="tab"
          :aria-selected="tab.id === activeId"
          :title="tab.title"
          :style="frozenWidth === null ? undefined : { width: `${frozenWidth}px` }"
          @pointerdown="onPointerDown(tab.id, $event)"
          @auxclick="onMiddleClick(tab.id, $event)"
        >
          <button class="tab-select" type="button" @dblclick="onRename(tab.id)">
            <span class="tab-glyph">
              <IconLoading
                v-if="stateOf(tab.id) === 'running'"
                class="tab-spin motion-reduce:animate-none"
              />

              <IconAlert v-else-if="stateOf(tab.id) === 'error'" />
              <IconSparkle v-else />
            </span>

            <span class="tab-title">{{ tab.title }}</span>
          </button>

          <button
            class="tab-close"
            type="button"
            :aria-label="`关闭 ${tab.title}`"
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
          {{ pinned(tab.id) ? "取消置顶" : "置顶" }}
        </ContextMenuItem>

        <ContextMenuItem @select="emit('rename', tab.id)">
          <IconPencil />
          重命名
        </ContextMenuItem>

        <template v-if="hasScope(tab.id)">
          <ContextMenuSeparator />

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'left') > 0"
            @select="emit('closeScope', tab.id, 'left')"
          >
            关闭左侧标签
          </ContextMenuItem>

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'right') > 0"
            @select="emit('closeScope', tab.id, 'right')"
          >
            关闭右侧标签
          </ContextMenuItem>

          <ContextMenuItem
            v-if="scopeCount(tab.id, 'others') > 0"
            @select="emit('closeScope', tab.id, 'others')"
          >
            关闭其他标签
          </ContextMenuItem>
        </template>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" @select="emit('delete', tab.id)">
          <IconTrash />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from "vue"
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
  rename: [id: string]
  togglePinned: [id: string]
  delete: [id: string]
}>()
const strip = useTemplateRef("strip")
const draggingId = ref<string>()
const frozenWidth = ref<number | null>(null)
const DRAG_DISTANCE = 6

function ids(): string[] {
  return props.tabs.map((tab) => tab.id)
}

function scopeCount(id: string, scope: "left" | "right" | "others"): number {
  return sessionTabsInCloseScope(ids(), id, scope).length
}

function hasScope(id: string): boolean {
  return scopeCount(id, "others") > 0
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
  const onUp = (up: PointerEvent) => {
    if (up.pointerId !== pointerId) return
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    draggingId.value = undefined

    if (!moved) emit("select", id)
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
}

function tabAt(clientX: number): string | undefined {
  const nodes = strip.value?.querySelectorAll<HTMLElement>(".session-tab")

  if (!nodes) return

  for (const [index, node] of nodes.entries()) {
    const box = node.getBoundingClientRect()

    if (clientX < box.left + box.width / 2) return props.tabs[index]?.id
  }

  return props.tabs.at(-1)?.id
}

function close(id: string): void {
  const tab = strip.value?.querySelector<HTMLElement>(".session-tab")

  if (tab && strip.value?.matches(":hover")) frozenWidth.value = tab.getBoundingClientRect().width
  emit("close", id)
}

function onMiddleClick(id: string, event: MouseEvent): void {
  if (event.button !== 1) return
  event.preventDefault()
  close(id)
}

function onRename(id: string): void {
  if (id === props.activeId) emit("rename", id)
}

function onMenuOpen(id: string, open: boolean): void {
  if (open && id !== props.activeId) emit("select", id)
}

function onWheel(event: WheelEvent): void {
  const node = strip.value

  if (!node || event.deltaX !== 0 || event.deltaY === 0) return
  node.scrollLeft += event.deltaY
}

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

.tab-spin {
  animation: tab-spin var(--duration-slow) linear infinite;
}

@keyframes tab-spin {
  to {
    rotate: 360deg;
  }
}

@media (pointer: coarse) {
  .session-tab:not(.active) .tab-close {
    pointer-events: none;
  }
}
</style>
