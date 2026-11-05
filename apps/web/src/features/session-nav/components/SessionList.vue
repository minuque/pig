<template>
  <nav class="nav-body session-list">
    <div v-if="sections.length" ref="windowEl" class="session-window" @scroll.passive="onScroll">
      <!-- 拖拽时露出的置顶落点：没有置顶段时给一块虚线占位 -->
      <section
        v-if="dragId && !hasPinnedSection"
        class="pinned-drop"
        :class="{ 'is-drop-active': dragIndex !== undefined }"
        data-key="pinned"
      >
        <div class="pinned-drop-zone">{{ t("session.pinned") }}</div>
      </section>

      <template v-for="section in inboxSections" :key="section.key">
        <div
          v-if="section.key === 'pinned'"
          class="drag-boundary"
          :class="{ 'is-shown': !!dragId, 'is-target': dragIndex !== undefined }"
        >
          <span class="drag-boundary-inner">
            <span class="drag-boundary-label">{{ t("session.pinned") }}</span>
            <span class="drag-boundary-line" aria-hidden="true"></span>
          </span>
        </div>

        <SessionSection
          v-bind="sectionBind(section)"
          @navigate="emit('navigate', $event)"
          @open="emit('open', $event)"
          @prime="emit('prime', $event)"
          @toggle-pinned="emit('togglePinned', $event)"
          @rename="(id, name) => emit('rename', id, name)"
          @delete="emit('delete', $event)"
          @settle="emit('settle', $event)"
          @unsettle="emit('unsettle', $event)"
          @drag-start="onDragStart"
          @toggle-section="emit('toggleSection', $event)"
          @reveal-more="emit('revealMore', $event)"
          @collapse-group="emit('collapseGroup', $event)"
        />

        <div
          v-if="section.key === 'pinned'"
          class="drag-boundary"
          :class="{ 'is-shown': !!dragId, 'is-target': dragUnpin }"
        >
          <span class="drag-boundary-inner">
            <span class="drag-boundary-label">{{ t("session.sectionInbox") }}</span>
            <span class="drag-boundary-line" aria-hidden="true"></span>
          </span>
        </div>
      </template>

      <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
    </div>

    <div v-else class="session-empty">{{ t("session.empty") }}</div>

    <!-- 架子固定在页脚上方，不随收件箱滚动；展开超出高度时自己滚。 -->
    <div v-if="shelfSections.length" class="session-shelves">
      <SessionSection
        v-for="section in shelfSections"
        :key="section.key"
        v-bind="sectionBind(section)"
        @navigate="emit('navigate', $event)"
        @open="emit('open', $event)"
        @prime="emit('prime', $event)"
        @toggle-pinned="emit('togglePinned', $event)"
        @rename="(id, name) => emit('rename', id, name)"
        @delete="emit('delete', $event)"
        @settle="emit('settle', $event)"
        @unsettle="emit('unsettle', $event)"
        @drag-start="onDragStart"
        @toggle-section="emit('toggleSection', $event)"
        @reveal-more="emit('revealMore', $event)"
        @collapse-group="emit('collapseGroup', $event)"
      />
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onUpdated, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import SessionSection from "@features/session-nav/components/SessionSection.vue"
import type { SidebarRowFoot, SidebarSection } from "@features/session-nav/type.js"

const props = defineProps<{
  sections: readonly SidebarSection[]
  /** 筛选态下 pinned 段只渲染命中项，DOM 序号与全表序号不再对应。 */
  filtered: boolean
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
// 过滤态下 pinned 段只渲染命中项，DOM 序号与 pinnedOrder 全表序号不再对应，禁用拖拽。
const dragEnabled = computed(() => !props.filtered)
const hasPinnedSection = computed(() => props.sections.some((section) => section.key === "pinned"))
/** 收件箱住滚动区，架子固定在页脚上方。 */
const inboxSections = computed(() => props.sections.filter((section) => !isShelf(section)))
const shelfSections = computed(() => props.sections.filter(isShelf))

function isShelf(section: SidebarSection): boolean {
  return section.kind === "working" || section.kind === "settled"
}

function sectionBind(section: SidebarSection) {
  return {
    section,
    highlightedSessionId: props.highlightedSessionId,
    expandedSections: props.expandedSections,
    cardFootById: props.cardFootById,
    pinnedIds: props.pinnedIds,
    runningSince: props.runningSince,
    dragEnabled: dragEnabled.value,
    dragId: dragId.value,
    dropVerb: dropVerb.value,
    rowShiftById: rowShiftById.value,
    moreBySection: props.moreBySection,
  }
}

const windowEl = shallowRef<HTMLElement>()

/** 滚到接近底部再放一页：收件箱不一次建完所有历史会话。 */
function onScroll(): void {
  const el = windowEl.value

  if (!el || el.scrollTop + el.clientHeight < el.scrollHeight - 240) return
  revealNextPage()
}

/** 内容不够高时直接补页：没有滚动条就等不到 scroll 事件。 */
function revealNextPage(): void {
  const active = props.sections.find((section) => section.kind === "active")

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

const dragId = shallowRef<string | undefined>(undefined)
const dragIndex = shallowRef<number | undefined>(undefined)
const dragHeight = shallowRef(0)
const dragSourcePinned = shallowRef(false)
const dragUnpin = shallowRef(false)
/** 置顶区下方的余量：指针落到这一段也算拖进置顶。 */
const PINNED_SLACK = 30
let dragCleanup: (() => void) | undefined
/** 拖着的那一行当前会落到哪：置顶、取消置顶，或只是区内换位。 */
const dropVerb = computed<"pin" | "unpin" | null>(() => {
  if (dragUnpin.value) return "unpin"

  if (dragIndex.value === undefined) return null
  return dragSourcePinned.value ? null : "pin"
})
/** 落点空出的一格：置顶行按落点为拖起的行让位。 */
const rowShiftById = computed<Record<string, number>>(() => {
  const id = dragId.value
  const target = dragIndex.value
  const height = dragHeight.value
  const pinned = props.sections.find((section) => section.key === "pinned")

  if (!id || target === undefined || !height || !pinned) return {}

  const ids = pinned.sessions.map((session) => session.id)
  const from = ids.indexOf(id)
  const shifts: Record<string, number> = {}

  if (from === -1) {
    for (let index = target; index < ids.length; index += 1) shifts[ids[index]!] = height
    return shifts
  }

  if (target === from || target === from + 1) return {}

  for (const [index, sessionId] of ids.entries()) {
    if (index === from) continue

    if (from < target && index > from && index < target) shifts[sessionId] = -height
    else if (target < from && index >= target && index < from) shifts[sessionId] = height
  }

  return shifts
})

function onDragStart(sectionKey: string, id: string, _event: PointerEvent) {
  dragId.value = id
  dragSourcePinned.value = sectionKey === "pinned"
  dragHeight.value =
    document
      .querySelector<HTMLElement>(`.session-row[data-id="${CSS.escape(id)}"]`)
      ?.getBoundingClientRect().height ?? 0

  /** 用每行自己的矩形算落点：section 含组头，按 section 顶算会整体偏下。 */
  function onMove(e: PointerEvent) {
    const section = document.querySelector<HTMLElement>('.session-list [data-key="pinned"]')

    if (!section) return clearDrop()

    // 空置顶段是 0 高占位，命中区取那块虚线框本身
    const box =
      section.querySelector<HTMLElement>(".pinned-drop-zone")?.getBoundingClientRect() ??
      section.getBoundingClientRect()
    const y = e.clientY

    // 置顶行拖出去落点在下沿之外即取消置顶；非置顶行只认置顶区与下方一小段余量。
    if (dragSourcePinned.value) {
      if (y < box.top || y > box.bottom) {
        dragUnpin.value = y > box.bottom
        dragIndex.value = undefined
        return
      }
    } else if (y < box.top || y > box.bottom + PINNED_SLACK) {
      return clearDrop()
    }

    const rows = [...section.querySelectorAll<HTMLElement>(".session-row")].filter(
      (row) => row.getBoundingClientRect().height > 0,
    )
    let index = rows.length

    for (const [i, row] of rows.entries()) {
      const rect = row.getBoundingClientRect()

      if (y < rect.top + rect.height / 2) {
        index = i
        break
      }
    }

    dragUnpin.value = false
    dragIndex.value = index
  }

  function clearDrop() {
    dragIndex.value = undefined
    dragUnpin.value = false
  }

  function onUp() {
    const over = dragIndex.value

    if (dragId.value) {
      if (dragUnpin.value) emit("unpin", dragId.value)
      else if (over !== undefined) {
        if (dragSourcePinned.value) emit("reorderPinned", dragId.value, over)
        else emit("pinAt", dragId.value, over)
      }
    }

    dragId.value = undefined
    dragSourcePinned.value = false
    clearDrop()
    window.removeEventListener("pointermove", onMove)
    window.removeEventListener("pointerup", onUp)
    window.removeEventListener("pointercancel", onUp)
    dragCleanup = undefined
  }

  window.addEventListener("pointermove", onMove)
  window.addEventListener("pointerup", onUp)
  window.addEventListener("pointercancel", onUp)
  dragCleanup = () => onUp()
}

onBeforeUnmount(() => {
  dragCleanup?.()
})
</script>

<style scoped>
.nav-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.session-list {
  position: relative;
}

.session-window {
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
  height: 32px;
}

/* 架子贴底：收件箱再长也不挤出视口，展开超过半屏时在区内滚动。 */
.session-shelves {
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

/* 没有置顶段时的落点：0 高占位，虚线框压在首行上，不挤动列表 */
.pinned-drop {
  position: relative;
  height: 0;
}

.pinned-drop-zone {
  position: absolute;
  inset-inline: 0;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  pointer-events: none;
}

.pinned-drop.is-drop-active .pinned-drop-zone {
  border-color: var(--primary);
  background: var(--info-bg);
  color: var(--primary);
}

/* 拖拽边界：0 高，拖起时露出区名与一条细线，落点在这一侧时变主色 */
.drag-boundary {
  position: relative;
  z-index: 2;
  height: 0;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
  pointer-events: none;
}

.drag-boundary.is-shown {
  opacity: 1;
}

.drag-boundary-inner {
  position: absolute;
  inset-inline: var(--space-xs);
  top: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.drag-boundary-label {
  flex: none;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  white-space: nowrap;
}

.drag-boundary-line {
  flex: 1;
  height: var(--border-width);
  background: var(--border);
}

.drag-boundary.is-target .drag-boundary-label {
  color: var(--primary);
}

.drag-boundary.is-target .drag-boundary-line {
  background: var(--primary);
}

.session-empty {
  padding: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

@media (prefers-reduced-motion: reduce) {
  .drag-boundary {
    transition: none;
  }
}
</style>
