<template>
  <TransferListsRoot
    :value="lists"
    :order="listOrder"
    :disabled="isLocked"
    :grab-key="isGrabKey"
    :item-label="titleOf"
    :list-label="listLabel"
    :message="announce"
    @value-change="onTransfer"
    @moving-change="dropOut.track"
  >
    <template #render="{ props: part, state }">
      <nav
        v-bind="part"
        ref="listEl"
        :aria-label="t('session.title')"
        class="nav-body session-list"
        :class="{
          'is-dragging': !!state.moving,
          'is-outside': dropOut.outside.value,
          'is-scrolled': scrolled,
        }"
      >
        <div
          v-if="sections.length"
          ref="windowEl"
          class="session-window"
          @scroll.passive="onScroll"
        >
          <div
            v-if="state.moving"
            class="drag-label"
            :class="{ 'is-target': state.to === 'pinned' }"
          >
            <span class="drag-label-text">{{ t("session.pinned") }}</span>
            <span class="drag-label-line" aria-hidden="true"></span>
          </div>

          <SessionSection
            v-bind="sectionBind(pinnedSection ?? emptyPinned, state)"
            :class="{ 'pinned-drop': !pinnedSection }"
            v-on="sectionOn"
          />

          <div
            v-if="state.moving"
            class="drag-label"
            :class="{ 'is-target': state.to === 'active' }"
          >
            <span class="drag-label-text">{{ t("session.sectionInbox") }}</span>
            <span class="drag-label-line" aria-hidden="true"></span>
          </div>

          <SessionSection
            v-if="activeSection"
            v-bind="sectionBind(activeSection, state)"
            v-on="sectionOn"
          />

          <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
        </div>

        <div v-else class="session-empty">{{ t("session.empty") }}</div>

        <div v-if="shelfSections.length" class="session-shelves">
          <SessionSection
            v-for="section in shelfSections"
            :key="section.key"
            v-bind="sectionBind(section, state)"
            v-on="sectionOn"
          />
        </div>

        <Teleport to="body">
          <div
            v-if="dropOut.ghost.value"
            class="drag-ghost"
            :style="{
              transform: `translate(${dropOut.ghost.value.x + 12}px, ${dropOut.ghost.value.y + 12}px)`,
            }"
          >
            <MessageSquareIcon class="size-icon" />
            <span class="drag-ghost-title">{{ dropOut.ghost.value.title }}</span>
          </div>
        </Teleport>
      </nav>
    </template>
  </TransferListsRoot>
</template>

<script setup lang="ts">
import { computed, onUpdated, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { MessageSquareIcon } from "@components/icons/index.js"
import {
  TransferListsRoot,
  type TransferChangeDetails,
  type TransferLists,
  type TransferMessage,
} from "@pig/ui/transfer-lists"
import SessionSection from "@features/session-nav/components/SessionSection.vue"
import { useRowSweep } from "@features/session-nav/hooks/use-row-sweep.js"
import { useSessionDropOut } from "@features/session-nav/hooks/use-session-drop-out.js"
import {
  pinnedSlot,
  planDrop,
  type DropPlan,
  type DropZone,
} from "@features/session-nav/lib/drag-plan.js"
import type {
  SidebarRowFoot,
  SidebarSection,
  SidebarSectionKind,
  SidebarSession,
} from "@features/session-nav/type.js"

const LISTS = ["pinned", "active", "settled"] as const
const MESSAGE_KEYS = {
  grab: "session.dragGrab",
  move: "session.dragMove",
  drop: "session.dragDrop",
  cancel: "session.dragCancel",
} as const
const props = defineProps<{
  sections: readonly SidebarSection[]
  cardFootById: ReadonlyMap<string, SidebarRowFoot>
  pinnedIds: ReadonlySet<string>
  highlightedSessionId: string | undefined
  expandedSections: ReadonlySet<string>
  moreBySection: Record<string, number>
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
  archive: [id: string]
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
const shelfSections = computed(() =>
  props.sections.filter((section) => section.kind === "working" || section.kind === "settled"),
)
const emptyPinned = computed<SidebarSection>(() => ({
  key: "pinned",
  kind: "pinned",
  label: t("session.pinned"),
  sessions: [],
  shown: 0,
  total: 0,
}))
const sessionsById = computed(
  () =>
    new Map<string, SidebarSession>(
      props.sections.flatMap((section) => section.sessions.map((item) => [item.id, item])),
    ),
)
const kindById = computed(
  () =>
    new Map<string, SidebarSectionKind>(
      props.sections.flatMap((section) => section.sessions.map((item) => [item.id, section.kind])),
    ),
)
const lists = computed<TransferLists>(() =>
  Object.fromEntries(
    LISTS.map((kind) => [
      kind,
      (props.sections.find((section) => section.kind === kind)?.sessions ?? []).map(
        (item) => item.id,
      ),
    ]),
  ),
)
const listEl = shallowRef<HTMLElement>()
const scrolled = shallowRef(false)
const windowEl = shallowRef<HTMLElement>()
const dropOut = useSessionDropOut({
  bounds: () => listEl.value,
  title: (id) => sessionsById.value.get(id)?.title,
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
const sectionOn = {
  navigate: (cwd: string | undefined) => emit("navigate", cwd),
  open: (id: string) => emit("open", id),
  prime: (id: string) => emit("prime", id),
  togglePinned: (id: string) => emit("togglePinned", id),
  rename: (id: string, name: string) => emit("rename", id, name),
  delete: (id: string) => emit("delete", id),
  settle: (id: string) => emit("settle", id),
  unsettle: (id: string) => emit("unsettle", id),
  archive: (id: string) => emit("archive", id),
  sweepStart: sweep.start,
  toggleSection: (key: string) => emit("toggleSection", key),
  revealMore: (key: string) => emit("revealMore", key),
  collapseGroup: (key: string) => emit("collapseGroup", key),
}
const listOrder = () => [...LISTS]
const isGrabKey = (event: KeyboardEvent) =>
  event.key === " " &&
  !event.altKey &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.shiftKey &&
  !(
    event.target instanceof Element &&
    event.target.closest("button, input, textarea, select, [contenteditable]")
  )
const titleOf = (id: string) => sessionsById.value.get(id)?.title

function isLocked(id: string): boolean {
  return Boolean(sessionsById.value.get(id)?.draft) || kindById.value.get(id) === "working"
}

function listLabel(list: string): string {
  if (list === "pinned") return t("session.pinned")
  return t(list === "settled" ? "session.sectionSettled" : "session.sectionInbox")
}

function announce(message: TransferMessage): string {
  return t(MESSAGE_KEYS[message.type], {
    label: message.label,
    list: message.list,
    position: message.position,
    total: message.total,
  })
}

function onTransfer(value: TransferLists, details: TransferChangeDetails): void {
  const order = [...props.pinnedIds]
  const pinned = value["pinned"] ?? []
  const plan = planDrop({
    id: details.key,
    from: details.from as SidebarSectionKind,
    zone: details.to as DropZone,
    pinnedOrder: order,
    slot: pinnedSlot(
      order,
      pinned.filter((id) => id !== details.key),
      pinned.indexOf(details.key),
    ),
  })

  if (dropOut.wasOutside() || plan.kind === "none") {
    details.cancel()
    return
  }

  commit(details.key, plan)
}

function commit(id: string, plan: DropPlan): void {
  if (plan.kind === "reorder-pinned") emit("reorderPinned", id, plan.slot)
  else if (plan.kind === "pin") emit("pinAt", id, plan.slot)
  else if (plan.kind === "unpin") emit("unpin", id)
  else if (plan.kind === "settle") emit("settle", id)
  else if (plan.kind === "unsettle") emit("unsettle", id)
}

function sectionBind(
  section: SidebarSection,
  state: { lists: TransferLists; moving: string | null },
) {
  const list = (LISTS as readonly string[]).includes(section.kind) ? section.kind : undefined
  return {
    section,
    list,
    order: list ? state.lists[list] : undefined,
    sessionsById: sessionsById.value,
    highlightedSessionId: props.highlightedSessionId,
    expandedSections: props.expandedSections,
    cardFootById: props.cardFootById,
    pinnedIds: props.pinnedIds,
    runningSince: props.runningSince,
    motion: !state.moving,
    swept: sweep.swept.value,
    moreBySection: props.moreBySection,
  }
}

function onScroll(): void {
  const el = windowEl.value

  scrolled.value = !!el && el.scrollTop > 0

  if (!el || el.scrollTop + el.clientHeight < el.scrollHeight - 240) return
  revealNextPage()
}

function revealNextPage(): void {
  const active = activeSection.value

  if (!active || active.shown >= active.total) return
  emit("revealMore", active.key)
}

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
  padding-inline-start: calc(var(--nav-inline) - var(--space-2xs));
}

.nav-body::before {
  content: "";
  position: absolute;
  z-index: var(--z-raise);
  inset-inline: var(--nav-inline);
  top: 0;
  height: var(--edge-fade-band);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
  background: linear-gradient(to bottom, var(--sidebar), transparent);
  pointer-events: none;
}

.nav-body.is-scrolled::before {
  opacity: 1;
}

.session-window {
  position: relative;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
  padding-inline: var(--space-2xs);
  padding-block-start: var(--space-2xs);
}

.session-window:hover,
.session-shelves:hover {
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--sidebar), transparent);
}

.session-shelves {
  position: relative;
  display: flex;
  flex: none;
  flex-direction: column;
  min-height: 0;
  max-height: 60%;
  overflow-x: hidden;
  overflow-y: auto;
  padding-inline: var(--space-2xs);
  padding-block-end: var(--space-2xs);
  background: var(--sidebar);
  scrollbar-width: thin;
  scrollbar-gutter: stable;
  scrollbar-color: transparent transparent;
}

.session-shelves :deep(.section-head) {
  position: sticky;
  top: 0;
  background: var(--sidebar);
}

.drag-label {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-xs);
  padding-inline: var(--space-xs);
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-list.is-outside .drag-label {
  opacity: 0;
}

.drag-label-text {
  flex: none;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.drag-label-line {
  flex: 1;
  height: var(--border-width);
  background: var(--border-subtle);
}

.drag-label.is-target .drag-label-text {
  color: var(--accent-text);
}

.drag-label.is-target .drag-label-line {
  background: var(--accent-solid);
}

.session-list.is-dragging:not(.is-outside) .pinned-drop :deep(.section-body) {
  min-height: var(--control-lg);
}

.session-list.is-dragging:not(.is-outside)
  .pinned-drop
  :deep(.section-body:not(:has(.session-row))) {
  border: var(--border-width) dashed var(--accent-solid);
  border-radius: var(--radius-control);
  background: var(--info-subtle);
}

:global(html[data-session-dragging] [data-drag-preview]) {
  opacity: 0;
}

.drag-ghost {
  position: fixed;
  top: 0;
  left: 0;
  z-index: var(--z-drag);
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  max-width: 240px;
  height: var(--control-sm);
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  background: var(--bg-raised);
  box-shadow: var(--shadow-popover);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  pointer-events: none;
}

.drag-ghost-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-empty {
  padding: var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
}

@media (prefers-reduced-motion: reduce) {
  .drag-label {
    transition: none;
  }
}
</style>
