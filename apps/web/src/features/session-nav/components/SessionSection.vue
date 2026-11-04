<template>
  <section class="session-section" :data-key="section.key">
    <div v-if="isShelf" class="section-head">
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
      <TransitionGroup name="list-reveal" tag="ul" class="section-rows">
        <li
          v-for="(session, index) in rows"
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
            v-bind="itemBind(session)"
            :dragging="dragId === session.id"
            @navigate="emit('navigate', $event)"
            @open="emit('open', $event)"
            @prime="emit('prime', $event)"
            @toggle-pinned="emit('togglePinned', $event)"
            @rename="(id, name) => emit('rename', id, name)"
            @delete="emit('delete', $event)"
            @settle="emit('settle', $event)"
            @unsettle="emit('unsettle', $event)"
            @drag-start="emit('dragStart', section.key, session.id, $event)"
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
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import SessionItem from "@features/session-nav/components/SessionItem.vue"
import { AltArrowDownIcon } from "@components/icons/index.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  section: SidebarSection
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  /** 在跑的会话从什么时候开始跑，秒表用。 */
  runningSince: Record<string, number>
  dragEnabled: boolean
  dragId: string | undefined
  dragIndex: number | undefined
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
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const isShelf = computed(() => props.section.kind === "working" || props.section.kind === "settled")
const open = computed(() => (isShelf.value ? props.expandedSections.has(props.section.key) : true))
/** 收起的架子不建行，展开后再补。 */
const rows = computed<readonly SidebarSession[]>(() => (open.value ? props.section.sessions : []))

function itemBind(session: SidebarSession) {
  const foot = props.cardFootById.get(session.id)
  return {
    session,
    active: session.id === props.highlightedSessionId,
    pinned: props.pinnedIds.has(session.id),
    settled: props.section.kind === "settled",
    variant: props.section.kind === "settled" ? "slim" : "card",
    startedAt: props.section.kind === "working" ? props.runningSince[session.id] : undefined,
    draggable: props.dragEnabled && !(session.draft ?? false),
    state: foot?.state,
    placeholder: session.draft ?? false,
  } as const
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

@media (prefers-reduced-motion: reduce) {
  .section-chevron,
  .more-icon {
    transition: none;
  }
}
</style>
