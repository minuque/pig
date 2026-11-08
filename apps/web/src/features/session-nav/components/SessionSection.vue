<template>
  <section class="session-section" :class="{ 'is-sorting': sorting }" :data-key="section.key">
    <div
      v-if="isShelf"
      class="section-head"
      :class="{ 'is-sorting': sorting, 'is-drop-target': dropTarget }"
      :data-drag-key="`${section.key}-head`"
      :style="shiftStyle(`${section.key}-head`)"
    >
      <button
        class="section-toggle"
        type="button"
        :aria-expanded="open"
        @click="emit('toggleSection', section.key)"
      >
        <span class="section-label">{{ section.label }}</span>
        <span class="section-rule" aria-hidden="true"></span>
        <span class="section-count">{{ section.total }}</span>
        <AltArrowDownIcon class="section-chevron" :class="{ 'is-collapsed': !open }" :size="12" />
      </button>
    </div>

    <div>
      <TransitionGroup :name="motion ? 'list-reveal' : 'none'" tag="ul" class="section-rows">
        <li
          v-for="session in rows"
          :key="session.id"
          class="session-row"
          :class="{ 'is-drag-source': dragId === session.id }"
          :style="shiftStyle(session.id)"
          :data-id="session.id"
          :data-drag-key="session.id"
          data-drag-item="row"
        >
          <SessionItem
            v-bind="itemBind(session)"
            :swept="swept.has(session.id)"
            @navigate="emit('navigate', $event)"
            @open="emit('open', $event)"
            @prime="emit('prime', $event)"
            @toggle-pinned="emit('togglePinned', $event)"
            @rename="(id, name) => emit('rename', id, name)"
            @delete="emit('delete', $event)"
            @settle="emit('settle', $event)"
            @unsettle="emit('unsettle', $event)"
            @drag-start="emit('dragStart', section.key, session.id, $event)"
            @sweep-start="emit('sweepStart', section.key, session.id, $event)"
          />
        </li>

        <li
          v-if="
            section.kind === 'settled' &&
            (section.shown < section.total || (moreBySection[section.key] ?? 0) > 0)
          "
          :key="`more:${section.key}`"
          class="session-row more-row"
          :data-drag-key="`more:${section.key}`"
          :style="shiftStyle(`more:${section.key}`)"
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
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { AltArrowDownIcon } from "@components/icons/index.js"
import { sidebarItemProps } from "@features/session-nav/lib/session-list.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  section: SidebarSection
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  /** 在跑的会话从什么时候开始跑，秒表用。 */
  runningSince: Record<string, number>
  /** 被拖起、由浮层代替显示的那一行。 */
  dragId: string | undefined
  /** 拖拽预演：各行相对静止布局的纵向位移。 */
  offsets: ReadonlyMap<string, number>
  /** 拖拽中：段头提亮，位移带过渡。 */
  sorting: boolean
  /** 拖着的行落在本段。 */
  dropTarget: boolean
  /** 关掉时行增删不做进出场动画：松手落位由列表自己做。 */
  motion: boolean
  swept: ReadonlySet<string>
  moreBySection: Record<string, number>
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
  dragStart: [sectionKey: string, id: string, event: PointerEvent]
  sweepStart: [sectionKey: string, id: string, event: PointerEvent]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const isShelf = computed(() => props.section.kind === "working" || props.section.kind === "settled")
const open = computed(() => (isShelf.value ? props.expandedSections.has(props.section.key) : true))
/** 收起的架子不建行，展开后再补。 */
const rows = computed<readonly SidebarSession[]>(() => (open.value ? props.section.sessions : []))

function shiftStyle(key: string): Record<string, string> | undefined {
  const shift = props.offsets.get(key)
  return shift ? { transform: `translateY(${shift}px)` } : undefined
}

function itemBind(session: SidebarSession) {
  return sidebarItemProps(props.section, session, props)
}
</script>

<style scoped>
/* 段落按内容定高，外层列表整体滚动 */
.session-section {
  flex: none;
  min-width: 0;
}

.section-head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  min-width: 0;
}

.section-head.is-sorting .section-toggle {
  color: var(--contrast-foreground);
}

.section-head.is-drop-target .section-toggle {
  color: var(--primary);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 32px;
  min-width: 0;
  /* 与会话卡同一档左右内边距：标题与卡内文字左对齐，箭头与时间右对齐 */
  padding-inline: 10px;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
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

/* 拖拽中让位带过渡；松手那一拍去掉过渡，落位交给列表的位移动画 */
.session-section.is-sorting .session-row,
.section-head.is-sorting {
  transition: transform var(--duration-fast) var(--ease-out);
}

/* 拖起的那一行由浮层代替，原处留位给投影计算 */
.session-row.is-drag-source {
  visibility: hidden;
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
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
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

@media (prefers-reduced-motion: reduce) {
  .session-section.is-sorting .session-row,
  .section-head.is-sorting,
  .section-chevron,
  .more-icon {
    transition: none;
  }
}
</style>
