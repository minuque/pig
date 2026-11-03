<template>
  <nav class="nav-body session-list">
    <div v-if="sections.length" class="session-window">
      <section
        v-if="dragId && !hasPinnedSection"
        class="session-section pinned-drop"
        :class="{ 'is-drop-active': dragIndex === 0 }"
        data-key="pinned"
      >
        <div class="section-head open">
          <span class="section-icon" aria-hidden="true"><PinIcon :size="15" /></span>
          <span class="section-label">{{ t("session.pinned") }}</span>
        </div>

        <div class="pinned-drop-zone"></div>
      </section>

      <template v-for="section in sections" :key="section.key">
        <section class="session-section" :data-key="section.key">
          <div
            class="section-head"
            :class="{
              open: expandedSections.has(section.key),
              'has-settings': section.key === settingsKey,
            }"
          >
            <button
              class="section-toggle"
              type="button"
              :aria-expanded="expandedSections.has(section.key)"
              @click="emit('toggleSection', section.key)"
            >
              <span v-if="section.key === 'pinned'" class="section-icon" aria-hidden="true">
                <component
                  :is="expandedSections.has(section.key) ? PinBoldIcon : PinIcon"
                  :size="15"
                />
              </span>

              <span
                v-else-if="section.key.startsWith('date:')"
                class="section-icon"
                aria-hidden="true"
              >
                <ClockCircleIcon :size="15" />
              </span>

              <span v-else-if="section.cwd" class="section-icon" aria-hidden="true">
                <component
                  :is="expandedSections.has(section.key) ? FolderOpenIcon : FolderIcon"
                  :size="15"
                />
              </span>

              <span
                class="section-label"
                :class="{ 'label-fade': sectionLabelOverflow[section.key] }"
                :data-key="section.key"
              >
                {{ section.label }}
              </span>

              <span v-if="!expandedSections.has(section.key)" class="section-count">
                {{ section.total }}
              </span>
            </button>

            <div v-if="section.cwd || section.key === settingsKey" class="section-actions">
              <Tooltip v-if="section.cwd">
                <TooltipTrigger as-child>
                  <button
                    class="section-add"
                    type="button"
                    :aria-label="t('session.newInProject')"
                    @click="emit('create', section.cwd)"
                  >
                    <ChatRoundAddIcon :size="15" />
                  </button>
                </TooltipTrigger>

                <TooltipContent>{{ t("session.newInProject") }}</TooltipContent>
              </Tooltip>

              <slot v-if="section.key === settingsKey" name="section-settings" />
            </div>
          </div>

          <div class="session-list-group" :class="{ 'is-open': expandedSections.has(section.key) }">
            <TransitionGroup name="list-reveal" tag="ul" class="section-rows">
              <li
                v-for="(session, index) in section.sessions"
                :key="session.id"
                class="session-row"
                :class="{
                  'drop-before': section.key === 'pinned' && dragIndex === index,
                  'drop-after':
                    section.key === 'pinned' &&
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
                  @drag-start="onDragStart(section.key, session.id, $event)"
                />
              </li>

              <li
                v-if="section.shown < section.total || (expandedByGroup[section.key] ?? 0) > 0"
                :key="`more:${section.key}`"
                class="session-row more-row"
              >
                <button
                  v-if="section.shown < section.total"
                  class="more-button"
                  type="button"
                  @click="emit('revealMore', section.key)"
                >
                  <DoubleAltArrowDownIcon class="more-icon" :size="13" />
                  {{ t("common.showMore") }}
                </button>

                <button
                  v-else
                  class="more-button"
                  type="button"
                  @click="emit('collapseGroup', section.key)"
                >
                  <DoubleAltArrowUpIcon class="more-icon" :size="13" />
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
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import {
  ChatRoundAddIcon,
  ClockCircleIcon,
  DoubleAltArrowDownIcon,
  DoubleAltArrowUpIcon,
  FolderIcon,
  FolderOpenIcon,
  PinIcon,
  PinBoldIcon,
} from "@components/icons/index.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  sections: readonly SidebarSection[]
  /** 筛选态下 pinned 段只渲染命中项，DOM 序号与全表序号不再对应。 */
  filtered: boolean
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  expandedByGroup: Record<string, number>
}>()
const emit = defineEmits<{
  navigate: [cwd: string | undefined]
  open: [id: string]
  prime: [id: string]
  create: [cwd?: string]
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
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
/** 项目设置按钮挂在第一个目录组头；全是日期组时退回第一组，保证菜单仍有入口。 */
const settingsKey = computed(
  () => (props.sections.find((section) => section.cwd) ?? props.sections[0])?.key,
)
const sectionLabelOverflow = shallowRef<Record<string, boolean>>({})
const dragId = shallowRef<string | undefined>(undefined)
const dragIndex = shallowRef<number | undefined>(undefined)
const dragSourcePinned = shallowRef(false)
const dragUnpin = shallowRef(false)
/** 置顶区下方的余量：指针落到这一段也算拖进置顶。 */
const PINNED_SLACK = 30
let dragCleanup: (() => void) | undefined

function measureLabelOverflow() {
  const map: Record<string, boolean> = {}
  document.querySelectorAll<HTMLElement>(".session-list .section-label").forEach((el) => {
    const key = el.getAttribute("data-key")

    if (key) map[key] = el.scrollWidth > el.clientWidth + 1
  })
  sectionLabelOverflow.value = map
}

watch(
  [() => props.sections, () => props.expandedSections],
  () => {
    nextTick(measureLabelOverflow)
  },
  { immediate: true },
)

function itemBind(session: SidebarSession, _section: SidebarSection) {
  const foot = props.cardFootById.get(session.id)
  return {
    session,
    active: session.id === props.highlightedSessionId,
    pinned: props.pinnedIds.has(session.id),
    draggable: dragEnabled.value && !(session.draft ?? false),
    state: foot?.state,
    placeholder: session.draft ?? false,
  }
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
  flex: 1;
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

.session-section + .session-section {
  margin-block-start: var(--space-xs);
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
  height: 26px;
  padding-inline: var(--space-xxs) 0;
  gap: var(--space-xxs);
}

.section-toggle {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground-secondary);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-caption--line-height);
  cursor: default;
  user-select: none;
}

.section-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 15px;
  height: 15px;
}

.section-head.open .section-toggle {
  color: var(--contrast-foreground);
}

/* 设置菜单从组头展开：宿主组头要盖过后面各组的组头，否则菜单被压住。 */
.section-head.has-settings {
  z-index: 3;
}

.section-label {
  min-width: 0;
  overflow: hidden;
  line-height: var(--text-eyebrow--line-height);
  padding-block: 1px;
  margin-block: -1px;
  white-space: nowrap;
}

.section-label.label-fade {
  text-overflow: ellipsis;
}

.section-count {
  flex: none;
  height: 16px;
  margin-inline-end: var(--space-xxs);
  padding-inline: var(--space-xxs);
  border-radius: var(--radius-xs);
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption-mono);
  line-height: 16px;
}

/* 箭头显形时数量让位，占位一起收起，箭头补到它原来的位置 */
.section-head:hover .section-count,
.section-toggle:focus-visible .section-count {
  display: none;
}

/* 收展箭头：主按钮的一部分，hover 才出现，不单独可点 */
.section-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  margin-inline-start: auto;
}

.section-add {
  display: grid;
  flex: none;
  place-items: center;
  width: 20px;
  height: 20px;
  /* 同搜索框首图标：15px 圆环形图标用 2 档描边才不发虚 */
  --solar-stroke-width: 2px;
  border: 0;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--contrast-foreground);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.section-head:hover .section-add,
.section-add:focus-visible {
  opacity: 1;
}

.section-add:hover {
  background: var(--glass-selected-bg);
  color: var(--contrast-foreground);
}

.section-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  margin: 0;
  /* 行底与高亮要贴到组宽右缘，右侧不再留内边距 */
  padding: var(--space-xxs) 0 0;
  list-style: none;
}

.session-row {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
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
  top: calc(var(--space-xxs) / -2 - 1px);
}

.session-row.drop-after::after {
  bottom: calc(var(--space-xxs) / -2 - 1px);
}

.more-button {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 26px;
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  cursor: default;
  transition:
    background-color var(--duration-fast) var(--ease-hover),
    color var(--duration-fast) var(--ease-hover);
}

.more-button:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

/* 箭头只在 hover 时显形；位置常驻，文字不跟着横移 */
.more-icon {
  flex: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
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
  .section-add,
  .more-icon {
    transition: none;
  }
}
</style>
