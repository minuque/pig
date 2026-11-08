<template>
  <nav
    ref="listEl"
    class="nav-body session-list"
    :class="{ 'is-dragging': !!drag, 'is-scrolled': scrolled }"
  >
    <div v-if="sections.length" ref="windowEl" class="session-window" @scroll.passive="onScroll">
      <!-- 拖拽时撑开的段名：置顶在上，收件箱在置顶段下沿；跨过收件箱那条才算换段 -->
      <div
        v-if="sorting"
        class="drag-label"
        :class="{ 'is-target': zone === 'pinned', 'is-hidden': outside }"
        data-drag-key="pinned-head"
        data-drag-item="label"
        :style="shiftStyle('pinned-head')"
      >
        <span class="drag-label-inner">
          <span class="drag-label-text">{{ t("session.pinned") }}</span>
          <span class="drag-label-line" aria-hidden="true"></span>
        </span>
      </div>

      <div
        v-if="sorting && !pinnedSection"
        class="drop-slot"
        :class="{ 'is-shown': zone === 'pinned' }"
        data-drag-key="pinned-slot"
        data-drag-item="slot"
        :style="shiftStyle('pinned-slot')"
      >
        <div class="drop-slot-box" :style="slotBoxStyle">{{ t("session.pinned") }}</div>
      </div>

      <SessionSection v-if="pinnedSection" v-bind="sectionBind(pinnedSection)" v-on="sectionOn" />

      <div
        v-if="sorting"
        class="drag-label"
        :class="{ 'is-target': zone === 'active', 'is-hidden': outside }"
        data-drag-key="pinned-divider"
        data-drag-item="label"
        :style="shiftStyle('pinned-divider')"
      >
        <span class="drag-label-inner">
          <span class="drag-label-text">{{ t("session.sectionInbox") }}</span>
          <span class="drag-label-line" aria-hidden="true"></span>
        </span>
      </div>

      <SessionSection v-if="activeSection" v-bind="sectionBind(activeSection)" v-on="sectionOn" />
      <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
    </div>

    <div v-else class="session-empty">{{ t("session.empty") }}</div>

    <!-- 架子固定在页脚上方，不随收件箱滚动；展开超出高度时自己滚。 -->
    <div v-if="shelfSections.length" ref="shelvesEl" class="session-shelves">
      <SessionSection
        v-for="section in shelfSections"
        :key="section.key"
        v-bind="sectionBind(section)"
        v-on="sectionOn"
      />
    </div>

    <!-- 拖起的行浮在两块滚动区之上，跨区时不被裁掉 -->
    <Teleport to="body">
      <ThemeRoot v-if="overlay" class="session-drag-layer">
        <div
          v-show="!outside"
          class="drag-overlay"
          :style="{
            top: `${overlayTop}px`,
            left: `${overlay.left}px`,
            width: `${overlay.width}px`,
          }"
        >
          <SessionItem v-bind="overlay.props" dragging :drop-verb="verb" />
        </div>

        <div
          v-if="ghost"
          class="drag-ghost"
          :style="{ transform: `translate(${ghost.x + 12}px, ${ghost.y + 12}px)` }"
        >
          <ChatSquareIcon class="size-icon" />
          <span class="drag-ghost-title">{{ overlay.props.session.title }}</span>
        </div>
      </ThemeRoot>
    </Teleport>
  </nav>
</template>

<script setup lang="ts">
import { computed, onUpdated, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { ThemeRoot } from "@components/ui/rt/index.js"
import { ChatSquareIcon } from "@components/icons/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import SessionSection from "@features/session-nav/components/SessionSection.vue"
import { useRowSweep } from "@features/session-nav/hooks/use-row-sweep.js"
import { useSessionDrag } from "@features/session-nav/hooks/use-session-drag.js"
import type { DropPlan } from "@features/session-nav/lib/drag-plan.js"
import { sidebarItemProps } from "@features/session-nav/lib/session-list.js"
import type { SidebarRowFoot, SidebarSection } from "@features/session-nav/type.js"

const props = defineProps<{
  sections: readonly SidebarSection[]
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  moreBySection: Record<string, number>
  /** 在跑的会话从什么时候开始跑，秒表用。 */
  runningSince: Record<string, number>
}>()
const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  open: [id: string]
  prime: [id: string]
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  settle: [id: string]
  unsettle: [id: string]
  reorderPinned: [id: string, toIndex: number]
  pinAt: [id: string, toIndex: number]
  unpin: [id: string]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const pinnedSection = computed(() => props.sections.find((section) => section.kind === "pinned"))
const activeSection = computed(() => props.sections.find((section) => section.kind === "active"))
/** 收件箱住滚动区，架子固定在页脚上方。 */
const shelfSections = computed(() =>
  props.sections.filter((section) => section.kind === "working" || section.kind === "settled"),
)
const listEl = shallowRef<HTMLElement>()
const scrolled = shallowRef(false)
const windowEl = shallowRef<HTMLElement>()
const shelvesEl = shallowRef<HTMLElement>()

function commit(id: string, plan: DropPlan): void {
  if (plan.kind === "reorder-pinned") emit("reorderPinned", id, plan.slot)
  else if (plan.kind === "pin") emit("pinAt", id, plan.slot)
  else if (plan.kind === "unpin") emit("unpin", id)
  else if (plan.kind === "settle") emit("settle", id)
  else if (plan.kind === "unsettle") emit("unsettle", id)
}

const {
  drag,
  zone,
  offsets,
  overlayTop,
  outside,
  ghost,
  releasing,
  sorting,
  verb,
  start: startDrag,
} = useSessionDrag({
  list: listEl,
  window: windowEl,
  shelves: shelvesEl,
  sections: () => props.sections,
  pinnedOrder: () => [...props.pinnedIds],
  commit,
})
const sweep = useRowSweep({
  list: listEl,
  sections: () => props.sections,
  apply: (ids, settled) => {
    for (const id of ids) {
      if (settled) emit("unsettle", id)
      else emit("settle", id)
    }
  },
})
const overlay = computed(() => {
  const d = drag.value
  return d
    ? { left: d.left, width: d.width, props: sidebarItemProps(d.section, d.session, props) }
    : undefined
})
/** 空置顶段的虚线框：撑到被拖行那么高。 */
const slotBoxStyle = computed(() => ({ height: `${(drag.value?.height ?? 0) - 4}px` }))
const sectionOn = {
  navigate: (cwd: string | undefined) => emit("navigate", cwd),
  open: (id: string) => emit("open", id),
  prime: (id: string) => emit("prime", id),
  togglePinned: (id: string) => emit("togglePinned", id),
  rename: (id: string, name: string) => emit("rename", id, name),
  delete: (id: string) => emit("delete", id),
  settle: (id: string) => emit("settle", id),
  unsettle: (id: string) => emit("unsettle", id),
  dragStart: startDrag,
  sweepStart: sweep.start,
  toggleSection: (key: string) => emit("toggleSection", key),
  revealMore: (key: string) => emit("revealMore", key),
  collapseGroup: (key: string) => emit("collapseGroup", key),
}

function shiftStyle(key: string): Record<string, string> | undefined {
  const shift = offsets.value.get(key)
  return shift ? { transform: `translateY(${shift}px)` } : undefined
}

function sectionBind(section: SidebarSection) {
  const d = drag.value
  return {
    section,
    highlightedSessionId: props.highlightedSessionId,
    expandedSections: props.expandedSections,
    cardFootById: props.cardFootById,
    pinnedIds: props.pinnedIds,
    runningSince: props.runningSince,
    dragId: d && !outside.value ? d.id : undefined,
    offsets: offsets.value,
    sorting: sorting.value,
    dropTarget: zone.value !== null && zone.value === section.kind,
    motion: !releasing.value,
    swept: sweep.swept.value,
    moreBySection: props.moreBySection,
  }
}

/** 滚到接近底部再放一页：收件箱不一次建完所有历史会话。 */
function onScroll(): void {
  const el = windowEl.value

  scrolled.value = !!el && el.scrollTop > 0

  if (!el || el.scrollTop + el.clientHeight < el.scrollHeight - 240) return
  revealNextPage()
}

/** 内容不够高时直接补页：没有滚动条就等不到 scroll 事件。 */
function revealNextPage(): void {
  const active = activeSection.value

  if (!active || active.shown >= active.total) return
  emit("revealMore", active.key)
}

// 只按分段内容判断：流式更新等无关重渲染不读布局
let lastSections: readonly SidebarSection[] | undefined

onUpdated(() => {
  if (props.sections === lastSections) return
  lastSections = props.sections
  const el = windowEl.value

  if (!el || el.scrollHeight > el.clientHeight + 4) return
  revealNextPage()
})
</script>

<style scoped>
.nav-body {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding-inline-start: var(--nav-inline);
}

/* 渐隐带挂在滚动区顶上：内容滚出视口才显示 */
.nav-body::before {
  content: "";
  position: absolute;
  z-index: 1;
  inset-inline: var(--nav-inline);
  top: 0;
  height: var(--edge-fade-band);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
  background: linear-gradient(to bottom, var(--background), transparent);
  pointer-events: none;
}

.nav-body.is-scrolled::before {
  opacity: 1;
}

/* 两块滚动区都当 offsetParent：拖拽按静止位置算落点 */
.session-window {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  /* 滚动条只在悬停时显形：槽位常驻，滑块平时透明，内容宽度不跳 */
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
  padding-block-start: var(--space-xxs);
}

.session-window:hover,
.session-shelves:hover {
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--background), transparent);
}

/* 架子贴底：收件箱再长也不挤出视口，展开超过半屏时在区内滚动。 */
.session-shelves {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  min-height: 0;
  max-height: 60%;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--background);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

/* 区内滚动时，组头钉在架上沿 */
.session-shelves :deep(.section-head) {
  position: sticky;
  top: 0;
  background: var(--background);
}

/* 没有置顶段时的落点：0 高占位，落点在置顶时撑出虚线框，下面的行让位 */
.drop-slot {
  position: relative;
  height: 0;
  transition: transform var(--duration-fast) var(--ease-out);
}

.drop-slot-box {
  position: absolute;
  inset-inline: 0;
  top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--primary);
  border-radius: var(--radius-md);
  background: var(--info-bg);
  color: var(--primary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.drop-slot.is-shown .drop-slot-box {
  opacity: 1;
}

/* 拖拽段名：0 高，靠投影让出一条，落点在这一段时变主色 */
.drag-label {
  position: relative;
  z-index: 2;
  height: 0;
  pointer-events: none;
  transition:
    transform var(--duration-fast) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.drag-label-inner {
  position: absolute;
  inset-inline: var(--space-xs);
  top: var(--space-xxs);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: 16px;
}

.drag-label-text {
  flex: none;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.drag-label-line {
  flex: 1;
  height: var(--border-width);
  background: var(--border-soft);
}

/* 拖出列表时段名收起，免得压在首行上 */
.drag-label.is-hidden {
  opacity: 0;
}

.drag-label.is-target .drag-label-text {
  color: var(--primary);
}

.drag-label.is-target .drag-label-line {
  background: var(--primary);
}

/* 拖动中列表不接指针：指针下的行不出悬停态，浮层也不会被当成悬停 */
.session-list.is-dragging .session-window,
.session-list.is-dragging .session-shelves {
  pointer-events: none;
}

.session-drag-layer {
  position: fixed;
  inset: 0;
  z-index: var(--z-drag);
  cursor: grabbing;
  pointer-events: none;
}

.session-drag-layer :deep(*) {
  pointer-events: none;
}

.drag-overlay {
  position: fixed;
  padding-block: 2px;
}

/* 拖出列表时跟着指针的小标签：松手会把这个会话带过去 */
.drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  max-width: 240px;
  height: 28px;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-md);
  background: var(--popover);
  box-shadow: var(--shadow-elevated);
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.drag-ghost-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-empty {
  padding: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
}

@media (prefers-reduced-motion: reduce) {
  .drop-slot,
  .drag-label,
  .drop-slot-box {
    transition: none;
  }
}
</style>
