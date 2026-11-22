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
        <ChevronDownIcon class="size-icon-sm section-chevron" :class="{ 'is-collapsed': !open }" />
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
            @archive="emit('archive', $event)"
            @drag-start="emit('dragStart', section.key, session.id, $event)"
            @sweep-start="emit('sweepStart', section.key, session.id, $event)"
          />
        </li>

        <li
          v-if="
            open &&
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
            <ChevronDownIcon class="size-icon-lg more-icon" />
            {{ t("common.showMore") }}
          </button>

          <button
            v-else
            class="more-button"
            type="button"
            @click="emit('collapseGroup', section.key)"
          >
            <ChevronDownIcon class="size-icon-lg more-icon is-up" />
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
import { ChevronDownIcon } from "@components/icons/index.js"
import { sidebarItemProps } from "@features/session-nav/lib/session-list.js"
import type { SidebarRowFoot, SidebarSection, SidebarSession } from "@features/session-nav/type.js"

const props = defineProps<{
  section: SidebarSection
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  runningSince: Record<string, number>
  dragId: string | undefined
  offsets: ReadonlyMap<string, number>
  sorting: boolean
  dropTarget: boolean
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
  archive: [id: string]
  dragStart: [sectionKey: string, id: string, event: PointerEvent]
  sweepStart: [sectionKey: string, id: string, event: PointerEvent]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
}>()
const { t } = useI18n()
const isShelf = computed(() => props.section.kind === "working" || props.section.kind === "settled")
const open = computed(() => (isShelf.value ? props.expandedSections.has(props.section.key) : true))
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
.session-section {
  flex: none;
  min-width: 0;
}

.section-head {
  position: relative;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  min-width: 0;
}

.section-head.is-sorting .section-toggle {
  color: var(--fg);
}

.section-head.is-drop-target .section-toggle {
  color: var(--accent-text);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 32px;
  min-width: 0;
  padding-inline: 10px;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-muted);
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

.session-section.is-sorting .session-row,
.section-head.is-sorting {
  transition: transform var(--duration-fast) var(--ease-out);
}

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
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-secondary);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
  cursor: default;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.more-button:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.more-icon {
  flex: none;
}

.more-icon.is-up {
  rotate: 180deg;
}

@media (prefers-reduced-motion: reduce) {
  .session-section.is-sorting .session-row,
  .section-head.is-sorting,
  .section-chevron {
    transition: none;
  }
}
</style>
