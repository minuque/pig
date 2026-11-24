<template>
  <Collapsible
    :open="open"
    @update:open="(next: boolean) => next !== open && emit('toggleSection', section.key)"
  >
    <template #render="{ props: part }">
      <section
        v-bind="part"
        class="session-section"
        :class="{ 'is-shelf': isShelf }"
        :data-key="section.key"
      >
        <component
          :is="list ? TransferList : 'div'"
          v-bind="list ? { value: list } : {}"
          class="section-body"
        >
          <div v-if="isShelf" class="section-head">
            <CollapsibleTrigger>
              <template #render="{ props: trigger }">
                <button v-bind="trigger" class="section-toggle" type="button">
                  <span class="section-label">{{ section.label }}</span>
                  <span class="section-rule" aria-hidden="true"></span>
                  <span class="section-count">{{ section.total }}</span>
                  <ChevronDownIcon class="size-icon-sm section-chevron" />
                </button>
              </template>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent class="section-panel">
            <component :is="isShelf ? ScrollArea : 'div'" class="section-scroll">
              <component :is="isShelf ? ScrollAreaViewport : 'div'" class="section-viewport">
                <component :is="isShelf ? ScrollAreaContent : 'div'" class="section-content">
                  <TransitionGroup
                    :name="motion ? 'list-reveal' : 'none'"
                    tag="ul"
                    class="section-rows"
                  >
                    <component
                      :is="list ? TransferItem : 'li'"
                      v-for="session in rows"
                      :key="session.id"
                      v-bind="list ? { value: session.id } : {}"
                      class="session-row"
                      :data-id="session.id"
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
                        @filter-project="emit('filterProject', $event)"
                        @sweep-start="emit('sweepStart', section.key, session.id, $event)"
                      />
                    </component>

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
                </component>
              </component>

              <ScrollAreaScrollbar v-if="isShelf" />
            </component>
          </CollapsibleContent>
        </component>
      </section>
    </template>
  </Collapsible>
</template>

<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "@i18n/index.js"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@pig/ui/collapsible"
import {
  ScrollArea,
  ScrollAreaContent,
  ScrollAreaScrollbar,
  ScrollAreaViewport,
} from "@pig/ui/scroll-area"
import { TransferItem, TransferList } from "@pig/ui/transfer-lists"
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
  list?: string | undefined
  order?: readonly string[] | undefined
  sessionsById: ReadonlyMap<string, SidebarSession>
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
  sweepStart: [sectionKey: string, id: string, event: PointerEvent]
  toggleSection: [key: string]
  revealMore: [key: string]
  collapseGroup: [key: string]
  filterProject: [cwd: string]
}>()
const { t } = useI18n()
const isShelf = computed(() => props.section.kind === "working" || props.section.kind === "settled")
const open = computed(() => (isShelf.value ? props.expandedSections.has(props.section.key) : true))
const rows = computed<readonly SidebarSession[]>(() =>
  props.order
    ? props.order.flatMap((id) => props.sessionsById.get(id) ?? [])
    : props.section.sessions,
)

function itemBind(session: SidebarSession) {
  return sidebarItemProps(props.section, session, props)
}
</script>

<style scoped>
.session-section {
  flex: none;
  min-width: 0;
}

.session-section.is-shelf,
.is-shelf .section-body,
.is-shelf .section-panel,
.is-shelf .section-scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.session-section.is-shelf,
.is-shelf .section-panel {
  flex: 0 1 auto;
}

.is-shelf .section-body,
.is-shelf .section-viewport {
  flex: 1 1 auto;
  min-height: 0;
}

.is-shelf .section-head,
.is-shelf .section-content {
  padding-inline: var(--space-2xs);
}

.section-head {
  position: relative;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  min-width: 0;
}

.section-body[data-drop-target] .section-toggle {
  color: var(--accent-text);
}

.section-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: var(--control-md);
  min-width: 0;
  padding-inline: calc(var(--spacing) * 2.5);
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
  margin-inline-end: calc(var(--icon-sm) / -4);
  transition: rotate var(--duration-fast) var(--ease-out);
}

.section-panel {
  interpolate-size: allow-keywords;
  height: auto;
  overflow: visible;
}

.section-panel:is([data-starting-style], [data-ending-style]) {
  height: 0;
  overflow: hidden;
}

.section-toggle[data-closed] .section-chevron {
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

.session-row[data-dragging] :deep(.session-card) {
  outline: var(--border-width) dashed var(--accent-solid);
  outline-offset: -1px;
  background: var(--info-subtle);
  opacity: 0.6;
}

.more-button {
  display: flex;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  width: 100%;
  height: var(--control-lg);
  padding-inline: calc(var(--spacing) * 2.5);
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
  .section-chevron {
    transition: none;
  }
}
</style>
