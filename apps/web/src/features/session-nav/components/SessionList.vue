<template>
  <nav class="nav-body session-list">
    <div v-if="sections.length" ref="windowEl" class="session-window" @scroll.passive="onScroll">
      <section
        v-if="dragId && !hasPinnedSection"
        class="session-section pinned-drop"
        :class="{ 'is-drop-active': dragIndex === 0 }"
        data-key="pinned"
      >
        <div class="pinned-drop-zone"></div>
      </section>

      <template v-for="section in sections" :key="section.key">
        <section
          class="session-section"
          :class="{ 'shelf-anchor': section.key === firstShelfKey }"
          :data-key="section.key"
        >
          <div v-if="isShelf(section)" class="section-head">
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="isOpen(section)"
              @click="emit('toggleSection', section.key)"
            >
              <span class="section-label">{{ section.label }}</span>
              <span class="section-rule" aria-hidden="true"></span>
              <span class="section-count">{{ section.total }}</span>

              <AltArrowDownIcon
                class="section-chevron"
                :class="{ 'is-collapsed': !isOpen(section) }"
                :size="12"
              />
            </button>
          </div>

          <div
            class="session-list-group"
            :class="{ 'is-open': isOpen(section) || hasHighlight(section) }"
          >
            <TransitionGroup name="list-reveal" tag="ul" class="section-rows">
              <li
                v-for="(session, index) in visibleRows(section)"
                :key="session.id"
                class="session-row"
                :class="{
                  'drop-before': section.kind === 'pinned' && dragIndex === index,
                  'drop-after':
                    section.kind === 'pinned' &&
                    dragIndex === section.sessions.length &&
                    index === section.sessions.length - 1,
                }"
                :data-id="session.id"
              >
                <SessionItem
                  v-bind="itemBind(session, section)"
                  :dragging="dragId === session.id"
                  @navigate="emit('navigate', session.cwd)"
                  @open="emit('open', $event)"
                  @prime="emit('prime', $event)"
                  @toggle-pinned="emit('togglePinned', $event)"
                  @rename="(id, name) => emit('rename', id, name)"
                  @delete="emit('delete', $event)"
                  @settle="emit('settle', $event)"
                  @unsettle="emit('unsettle', $event)"
                  @drag-start="onDragStart(section.key, session.id, $event)"
                />
              </li>

              <li
                v-if="
                  section.kind === 'settled' &&
                  (section.shown < section.total || (moreBySection[section.key] ?? 0) > 0)
                "
                :key="`more:${section.key}`"
                class="session-row more-row"
              >
                <button
                  v-if="section.shown < section.total"
                  class="more-button"
                  type="button"
                  @click="emit('revealMore', section.key)"
                >
                  <AltArrowDownIcon class="more-icon" :size="16" />
                  {{ t("common.showMore") }}
                </button>

                <button
                  v-else
                  class="more-button"
                  type="button"
                  @click="emit('collapseGroup', section.key)"
                >
                  <AltArrowDownIcon class="more-icon is-up" :size="16" />
                  {{ t("common.collapse") }}
                </button>
              </li>
            </TransitionGroup>
          </div>
        </section>

        <div v-if="section.key === 'pinned' && dragUnpin" class="unpin-hint">
          {{ t("session.unpinHint") }}
        </div>
      </template>

      <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
    </div>

    <div v-else class="session-empty">{{ t("session.empty") }}</div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onUpdated, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { AltArrowDownIcon } from "@components/icons/index.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

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
/** 第一个架子贴着列表底：上面的收件箱短时，架子仍落在底边。 */
const firstShelfKey = computed(() => props.sections.find(isShelf)?.key)

function isShelf(section: SidebarSection): boolean {
  return section.kind === "working" || section.kind === "settled"
}

function isOpen(section: SidebarSection): boolean {
  return isShelf(section) ? props.expandedSections.has(section.key) : true
}

/** 收起的架子不建行：只留正在看的那一条，展开后再补。 */
function visibleRows(section: SidebarSection): readonly SidebarSession[] {
  if (isOpen(section)) return section.sessions
  const open = section.sessions.find((session) => session.id === props.highlightedSessionId)
  return open ? [open] : []
}

/** 收起但正开着的那条要露出来：行建了，组也得跟着开。 */
function hasHighlight(section: SidebarSection): boolean {
  return (
    !isOpen(section) &&
    section.sessions.some((session) => session.id === props.highlightedSessionId)
  )
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

onUpdated(() => {
  const el = windowEl.value

  if (!el || el.scrollHeight > el.clientHeight + 4) return
  revealNextPage()
})

const dragId = shallowRef<string | undefined>(undefined)
const dragIndex = shallowRef<number | undefined>(undefined)
const dragSourcePinned = shallowRef(false)
const dragUnpin = shallowRef(false)
/** 置顶区下方的余量：指针落到这一段也算拖进置顶。 */
const PINNED_SLACK = 30
let dragCleanup: (() => void) | undefined

function itemBind(session: SidebarSession, section: SidebarSection) {
  const foot = props.cardFootById.get(session.id)
  return {
    session,
    active: session.id === props.highlightedSessionId,
    pinned: props.pinnedIds.has(session.id),
    settled: section.kind === "settled",
    variant: section.kind === "settled" ? "slim" : "card",
    startedAt: section.kind === "working" ? props.runningSince[session.id] : undefined,
    draggable: dragEnabled.value && !(session.draft ?? false),
    state: foot?.state,
    placeholder: session.draft ?? false,
  } as const
}

function onDragStart(sectionKey: string, id: string, _event: PointerEvent) {
  dragId.value = id
  dragSourcePinned.value = sectionKey === "pinned"

  /** 用每行自己的矩形算落点：section 含组头，按 section 顶算会整体偏下。 */
  function onMove(e: PointerEvent) {
    const section = document.querySelector<HTMLElement>(
      '.session-list .session-section[data-key="pinned"]',
    )

    if (!section) return clearDrop()
    const box = section.getBoundingClientRect()
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

.session-window:hover {
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--background), transparent);
  height: 32px;
}

/* 段落按内容定高，列表整体滚动；被压扁时折叠组会把多余行裁掉 */
.session-section {
  flex: none;
  min-width: 0;
}

/* 收起的架子直接不建行，这里不用 grid 开合：块级流让长列表撑高、外层滚动 */
.session-list-group {
  display: block;
}

/* 架子贴底：收件箱短时，三个架子仍落在列表下沿。 */
.session-section.shelf-anchor {
  margin-block-start: auto;
}

/* 拖起会话时露出的置顶落点：没有置顶段也能拖进去 */
.pinned-drop {
  margin-block-end: var(--space-xs);
}

.pinned-drop-zone {
  height: 26px;
  margin: var(--space-xxs) var(--nav-inline, var(--space-xs)) 0 0;
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
}

.pinned-drop.is-drop-active .pinned-drop-zone {
  border-color: var(--primary);
  background: var(--glass-selected-bg);
}

/* 置顶行拖到列表下方：提示松手取消置顶 */
.unpin-hint {
  margin-block-start: var(--space-xxs);
  padding-block: var(--space-xxs);
  border: 1px dashed var(--border);
  border-radius: var(--radius-sm);
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-align: center;
}

.section-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-width: 0;
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 32px;
  min-width: 0;
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-eyebrow--line-height);
  cursor: default;
  user-select: none;
}

.section-label {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

/* 占位分隔线：有计数时不画线，但要让计数与箭头停在右缘。 */
.section-rule {
  flex: 1;
  height: 1px;
  min-width: var(--space-xs);
  visibility: hidden;
}

.section-count {
  flex: none;
  font-weight: var(--font-weight-normal);
  font-variant-numeric: tabular-nums;
}

/* 箭头贴着计数：收起时朝右，展开时朝下 */
.section-chevron {
  flex: none;
  transition: rotate var(--duration-fast) var(--ease-out);
}

.section-chevron.is-collapsed {
  rotate: -90deg;
}

.section-rows {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin: 0;
  /* 行底与高亮要贴到组宽右缘，右侧不再留内边距 */
  padding: 0;
  list-style: none;
}

.session-row {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-block: 2px;
}

/* 落点指示画在行上：独立成 TransitionGroup 子节点会卡在进出动画里。 */
.session-row.drop-before::before,
.session-row.drop-after::after {
  position: absolute;
  inset-inline: 0;
  height: 2px;
  background: var(--primary);
  border-radius: var(--radius-pill);
  opacity: 0.6;
  content: "";
}

.session-row.drop-before::before {
  top: 0;
}

.session-row.drop-after::after {
  bottom: 0;
}

.more-button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  height: 36px;
  padding-inline: 10px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  cursor: default;
  transition:
    background-color var(--duration-fast) var(--ease-hover),
    color var(--duration-fast) var(--ease-hover);
}

.more-button:hover {
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground);
}

/* 箭头只在 hover 时显形；位置常驻，文字不跟着横移 */
.more-icon {
  flex: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.more-icon.is-up {
  rotate: 180deg;
}

.more-button:hover .more-icon,
.more-button:focus-visible .more-icon {
  opacity: 1;
}

.session-empty {
  padding: var(--space-xs);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
}

@media (prefers-reduced-motion: reduce) {
  .section-chevron,
  .more-icon {
    transition: none;
  }
}
</style>
