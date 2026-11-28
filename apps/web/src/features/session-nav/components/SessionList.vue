<template>
  <TransferListsRoot
    :value="lists"
    :order="listOrder"
    :disabled="isLocked"
    :reorderable="isReorderable"
    :accepts="canAccept"
    :bounds="listBounds"
    :outside-consumed="dropOut.wasConsumed"
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
          'is-outside': dropOut.outside.value || state.outside,
          'is-scrolled': scrolled,
        }"
      >
        <div ref="windowEl" class="session-window" @scroll.passive="onScroll">
          <div
            v-if="isSidebarDrag(state)"
            data-drag-flow
            class="drag-label"
            :class="{ 'is-target': state.to === 'pinned' }"
          >
            <span class="drag-label-text">{{ t("session.pinned") }}</span>
            <span class="drag-label-line" aria-hidden="true"></span>
          </div>

          <SessionSection
            v-bind="sectionBind(pinnedSection ?? emptyPinned, state)"
            :class="{ 'empty-drop': (state.lists.pinned?.length ?? 0) === 0 }"
            v-on="sectionOn"
          />

          <div
            v-if="isSidebarDrag(state)"
            data-drag-flow
            class="drag-label"
            :class="{ 'is-target': state.to === 'active' }"
          >
            <span class="drag-label-text">{{ t("session.sectionInbox") }}</span>
            <span class="drag-label-line" aria-hidden="true"></span>
          </div>

          <SessionSection
            v-if="activeSection || isSidebarDrag(state)"
            v-bind="sectionBind(activeSection ?? emptyActive, state)"
            class="active-section"
            :class="{ 'empty-drop': (state.lists.active?.length ?? 0) === 0 }"
            v-on="sectionOn"
          />

          <EmptyState
            v-else-if="!pinnedSection && !state.moving"
            :title="sections.length ? t('session.inboxEmpty') : t('session.empty')"
          >
            <template #art><HairlineArt figure="basket" /></template>

            <template #actions>
              <Button variant="outline" color="neutral" class="new-session" @click="emit('create')">
                <MessageCirclePlusIcon class="size-icon" />
                {{ t("session.newSession") }}
              </Button>
            </template>
          </EmptyState>

          <div class="session-edge-bottom edge-veil-bottom" aria-hidden="true"></div>
        </div>

        <div v-if="shelfSections.length" class="session-shelves">
          <SessionSection
            v-for="section in shelfSections"
            :key="section.key"
            v-bind="sectionBind(section, state)"
            v-on="sectionOn"
          />
        </div>

        <SessionDragGhost :ghost="dropOut.ghost.value" />
      </nav>
    </template>
  </TransferListsRoot>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, shallowRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { EmptyState } from "@pig/ui/empty-state"
import HairlineArt from "@components/empty/HairlineArt.vue"
import { MessageCirclePlusIcon } from "@components/icons/index.js"
import { Button } from "@pig/ui/button"
import {
  TransferListsRoot,
  type TransferChangeDetails,
  type TransferLists,
  type TransferMessage,
} from "@pig/ui/transfer-lists"
import SessionDragGhost from "@features/session-nav/components/SessionDragGhost.vue"
import SessionSection from "@features/session-nav/components/SessionSection.vue"
import { useRowSweep } from "@features/session-nav/hooks/use-row-sweep.js"
import { useSessionDropOut } from "@features/session-nav/hooks/use-session-drop-out.js"
import { trackHoverGate } from "@features/session-nav/lib/hover-gate.js"
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
  create: []
  settleMany: [ids: readonly string[]]
  unsettleMany: [ids: readonly string[]]
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
const emptyActive = computed<SidebarSection>(() => ({
  key: "active",
  kind: "active",
  label: t("session.sectionInbox"),
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
let stopGate: (() => void) | undefined

onMounted(() => {
  if (listEl.value) stopGate = trackHoverGate(listEl.value)
})

onBeforeUnmount(() => stopGate?.())

const dropOut = useSessionDropOut({
  bounds: () => listEl.value,
  title: (id) => sessionsById.value.get(id)?.title,
})
const sweep = useRowSweep({
  list: listEl,
  sections: () => props.sections,
  apply: (ids, settled) => {
    if (ids.length === 0) return

    if (settled) emit("unsettleMany", ids)
    else emit("settleMany", ids)
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
const titleOf = (id: string) => sessionsById.value.get(id)?.title
const listBounds = () => listEl.value
const isReorderable = (list: string) => list === "pinned"
const canAccept = (_key: string, from: string, to: string) => to === "pinned" || to !== from

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

function isSidebarDrag(state: { moving: string | null; outside?: boolean }): boolean {
  return Boolean(state.moving) && !dropOut.outside.value && !state.outside
}

function sectionBind(
  section: SidebarSection,
  state: {
    lists: TransferLists
    moving: string | null
    to?: string | null
    outside?: boolean
    settling?: string | null
  },
) {
  const list = (LISTS as readonly string[]).includes(section.kind) ? section.kind : undefined
  const activeDrag = isSidebarDrag(state)
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
    motion: !state.moving && !state.settling,
    dragging: activeDrag,
    dropTarget: Boolean(list && activeDrag && state.to === list),
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
  padding-inline: calc(var(--nav-inline) - var(--space-2xs));
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

.session-window,
.session-shelves {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.session-window {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  padding: var(--space-2xs) var(--space-2xs) 0;
}

.session-shelves {
  flex: none;
  max-height: 60%;
  padding-block-end: var(--space-2xs);
}

.session-edge-bottom {
  background: linear-gradient(to top, var(--sidebar), transparent);
}

.drag-label {
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-2xs);
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

.active-section {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}

.active-section :deep(.section-body) {
  flex: 1;
}

.session-list.is-dragging:not(.is-outside) .empty-drop :deep(.section-body) {
  min-height: var(--control-lg);
}

.session-list.is-dragging:not(.is-outside)
  .empty-drop
  :deep(.section-body:not(:has(.session-row))) {
  border: var(--border-width) dashed var(--border-strong);
  border-radius: var(--radius-control);
}

.session-list.is-dragging:not(.is-outside)
  .empty-drop
  :deep(.section-body[data-drop-target]:not(:has(.session-row))) {
  border-color: var(--accent-solid);
  background: var(--info-subtle);
}

:global(html[data-session-dragging] [data-drag-preview]) {
  opacity: 0;
}

.new-session {
  border-style: dashed;
}

@media (prefers-reduced-motion: reduce) {
  .drag-label {
    transition: none;
  }
}
</style>
