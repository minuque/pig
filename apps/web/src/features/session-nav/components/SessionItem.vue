<template>
  <div
    class="session-item"
    :class="{
      'is-menu-open': menuOpen,
      'is-placeholder': placeholder,
      'is-swept': swept,
    }"
  >
    <ContextMenu :modal="false" @update:open="menuOpen = $event">
      <HoverCard
        v-model:open="hoverOpen"
        :disabled="placeholder || renaming || menuOpen || forkHover || pressed"
      >
        <HoverCardTrigger>
          <template #render="{ props: card }">
            <ContextMenuTrigger v-bind="card">
              <template #render="{ props: part }">
                <component
                  v-bind="part"
                  :is="placeholder ? 'div' : RouterLink"
                  :ref="setCardEl"
                  class="session-card"
                  :class="[
                    variant,
                    {
                      active: active || splitShown,
                      'is-placeholder': placeholder,
                      'is-settled': settled,
                      renaming,
                    },
                  ]"
                  :to="
                    placeholder ? undefined : { name: 'session', params: { sessionId: session.id } }
                  "
                  draggable="false"
                  @click="onCardClick"
                  @dblclick="onCardDblclick"
                  @pointerdown.left="onCardPointerDown"
                  @pointerleave="onCardLeave"
                  @dragstart.prevent
                  @keydown="onCardKeydown"
                >
                  <template v-if="variant === 'card'">
                    <span class="meta-line">
                      <span v-if="projectName" class="project-icon" aria-hidden="true">
                        <ProjectIcon class="project-mono" :path="session.cwd" fallback="monogram" />
                      </span>

                      <SessionPinToggle
                        v-if="pinned"
                        :disabled="placeholder"
                        @toggle="emit('togglePinned', session.id)"
                      />

                      <span class="project-name">{{ projectName }}</span>
                      <SessionStateSlot v-if="!renaming" v-bind="slotProps" v-on="slotEvents" />
                    </span>

                    <span class="title-line">
                      <SessionRenameInput
                        v-if="renaming"
                        :title="session.title"
                        @commit="commitRename"
                        @cancel="renaming = false"
                      />

                      <template v-else>
                        <span class="title">{{ session.title }}</span>

                        <SessionRowMarks
                          v-if="foot && !foot.git"
                          :foot="foot"
                          @open="emit('open', $event)"
                          @fork-hover="forkHover = $event"
                        />
                      </template>
                    </span>

                    <Transition name="list-reveal">
                      <span v-if="foot?.git && !renaming" class="context-line">
                        <FolderGit2Icon
                          v-if="foot.git.worktree"
                          class="size-icon-sm context-icon"
                        />

                        <GitBranchIcon v-else class="size-icon-sm context-icon" />
                        <span class="context-text">{{ foot.git.branch }}</span>

                        <SessionRowMarks
                          :foot="foot"
                          @open="emit('open', $event)"
                          @fork-hover="forkHover = $event"
                        />
                      </span>
                    </Transition>
                  </template>

                  <template v-else>
                    <span class="project-icon" aria-hidden="true">
                      <ProjectIcon
                        v-if="projectName"
                        class="project-mono"
                        :path="session.cwd"
                        fallback="monogram"
                      />
                    </span>

                    <SessionRenameInput
                      v-if="renaming"
                      :title="session.title"
                      @commit="commitRename"
                      @cancel="renaming = false"
                    />

                    <template v-else>
                      <span class="title">{{ session.title }}</span>
                      <SessionStateSlot v-bind="slotProps" v-on="slotEvents" />
                    </template>
                  </template>
                </component>
              </template>
            </ContextMenuTrigger>
          </template>
        </HoverCardTrigger>

        <SessionHoverCard
          :session="session"
          :project-name="projectName"
          :foot="foot"
          @filter-project="emit('filterProject', $event)"
          @open="emit('open', $event)"
        />
      </HoverCard>

      <SessionItemMenu
        v-if="!placeholder"
        :session-id="session.id"
        :pinned="pinned"
        :settled="settled"
        :working="startedAt !== undefined"
        @rename="startRename"
        @toggle-pinned="emit('togglePinned', session.id)"
        @settle="emit('settle', session.id)"
        @unsettle="emit('unsettle', session.id)"
        @archive="emit('archive', session.id)"
        @delete="deleteOpen = true"
      />
    </ContextMenu>

    <SessionItemDelete
      v-if="!placeholder"
      v-model:open="deleteOpen"
      :title="session.title"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, shallowRef, watch, type ComponentPublicInstance } from "vue"
import { RouterLink } from "vue-router"
import { ContextMenu, ContextMenuTrigger } from "@pig/ui/context-menu"
import { HoverCard, HoverCardTrigger } from "@pig/ui/hover-card"
import SessionRowMarks from "@features/session-nav/components/SessionRowMarks.vue"
import SessionHoverCard from "@features/session-nav/components/SessionHoverCard.vue"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import SessionItemMenu from "@features/session-nav/components/SessionItemMenu.vue"
import SessionPinToggle from "@features/session-nav/components/SessionPinToggle.vue"
import SessionRenameInput from "@features/session-nav/components/SessionRenameInput.vue"
import SessionStateSlot from "@features/session-nav/components/SessionStateSlot.vue"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import { pressedCard, trackPressedCard } from "@features/session-nav/lib/pressed-card.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import type { SidebarRowFoot, SidebarSession } from "@features/session-nav/type.js"
import { trySplitView } from "@features/split-view/index.js"
import { FolderGit2Icon, GitBranchIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    settled?: boolean
    foot?: SidebarRowFoot | undefined
    variant?: "card" | "slim"
    startedAt?: number | undefined

    placeholder?: boolean
    swept?: boolean
  }>(),
  {
    foot: undefined,
    variant: "card",
    startedAt: undefined,
    placeholder: false,
    swept: false,
  },
)
const emit = defineEmits<{
  navigate: []
  open: [id: string]
  prime: [id: string]
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  settle: [id: string]
  unsettle: [id: string]
  archive: [id: string]
  sweepStart: [event: PointerEvent]
  filterProject: [cwd: string]
}>()
const forkHover = shallowRef(false)
const split = trySplitView()
const splitShown = computed(
  () =>
    Boolean(split?.split.value) &&
    (split!.state.value.left === props.session.id || split!.state.value.right === props.session.id),
)
const menuOpen = shallowRef(false)
const hoverOpen = shallowRef(false)
const cardEl = shallowRef<Element | null>(null)
const pressed = computed(() => cardEl.value !== null && pressedCard.value === cardEl.value)

trackPressedCard()

watch(pressed, (value) => {
  if (value) hoverOpen.value = false
})

const deleteOpen = shallowRef(false)
const renaming = shallowRef(false)
const projectName = computed(() => (props.session.cwd ? workspaceName(props.session.cwd) : ""))
const slotProps = computed(() => ({
  session: props.session,
  foot: props.foot,
  variant: props.variant,
  settled: props.settled,
  startedAt: props.startedAt,
  placeholder: props.placeholder,
}))
const slotEvents = {
  settle: () => emit("settle", props.session.id),
  unsettle: () => emit("unsettle", props.session.id),
  sweepStart: (event: PointerEvent) => emit("sweepStart", event),
}

function startRename() {
  if (!props.placeholder) renaming.value = true
}

function commitRename(name: string) {
  if (!renaming.value) return
  renaming.value = false
  const trimmed = name.trim()

  if (!trimmed || trimmed === props.session.title) return
  emit("rename", props.session.id, trimmed)
}

function isModifiedSessionClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function setCardEl(el: Element | ComponentPublicInstance | null) {
  cardEl.value = el instanceof Element ? el : ((el?.$el as Element | undefined) ?? null)
}

function onCardLeave() {
  if (pressed.value) pressedCard.value = null
}

function onCardPointerDown(event: PointerEvent) {
  if (props.placeholder || isModifiedSessionClick(event)) return
  emit("prime", props.session.id)

  if (renaming.value) event.stopPropagation()
}

function onCardClick(event: MouseEvent) {
  if (props.placeholder || menuOpen.value || renaming.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit("navigate")

  if (split && event.altKey && event.button === 0) {
    event.preventDefault()
    split.openToSide(props.session.id)
    return
  }

  if (isModifiedSessionClick(event)) return
  event.preventDefault()
  emit("open", props.session.id)
}

function onCardDblclick(event: MouseEvent) {
  if (props.placeholder || isModifiedSessionClick(event)) return
  event.preventDefault()
  startRename()
}

function onCardKeydown(event: KeyboardEvent) {
  if (props.placeholder || event.key !== "F2") return
  event.preventDefault()
  startRename()
}

function confirmDelete() {
  deleteOpen.value = false
  emit("delete", props.session.id)
}
</script>

<style scoped>
.session-item {
  position: relative;
  width: 100%;
  min-width: 0;
}

.session-card {
  position: relative;
  display: flex;
  min-width: 0;
  width: 100%;
  border-radius: var(--radius-control);
  background: transparent;
  color: inherit;
  text-decoration: none;
  cursor: default;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.session-card.card {
  flex-direction: column;
  gap: var(--space-2xs);
  min-height: calc(var(--control-lg) + var(--space-lg));
  padding: var(--space-xs) calc(var(--spacing) * 2.5);
}

.session-card.slim {
  flex-direction: row;
  align-items: center;
  gap: calc(var(--spacing) * 2.5);
  height: var(--control-lg);
  padding-inline: calc(var(--spacing) * 2.5);
}

.session-item:hover :where(.session-card:not(.active, [data-open])) {
  background: var(--bg-hover);
}

.session-card[data-open],
.session-card.active {
  background: var(--bg-selected);
}

.session-item .session-card.is-placeholder {
  background: var(--warning-subtle);
}

.project-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--icon-lg);
  height: var(--icon-lg);
  color: var(--fg-secondary);
}

.project-mono[data-tone] {
  justify-content: center;
  width: var(--icon-lg);
  height: var(--icon-lg);
  padding: 0;
  border-radius: var(--radius-min);
  font-size: calc(var(--text-body) - 5px);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  letter-spacing: 0;
}

.meta-line {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
  height: var(--control-2xs);
}

.project-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-line {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  height: var(--control-2xs);
}

.context-line {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  margin-block-start: calc(var(--space-2xs) / -2);
  color: var(--fg-muted);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

.context-line:is(.list-reveal-enter-from, .list-reveal-leave-to) {
  margin-block-start: calc(var(--space-2xs) * -1);
}

.context-icon {
  flex: none;
}

.context-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--control-2xs);
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-out);
}

.session-item:hover .title,
.session-card[data-open] .title,
.session-card.active .title {
  color: var(--fg);
}

.session-card.slim .title {
  flex: 1;
}

.session-card.is-settled
  :is(.project-name, .project-icon, .project-mono, .project-mono[data-tone]) {
  color: var(--fg-muted);
}

.session-card.is-settled .project-mono[data-slot="badge"] {
  background-color: var(--bg-muted);
}

.session-item:not(:hover) .session-card.is-settled:not(.active, [data-open]) .title {
  color: var(--fg-muted);
}

:global([data-drag-preview] .session-item .session-card) {
  background: var(--bg-raised);
  color: var(--fg);
  box-shadow: var(--shadow-popover);
  cursor: grabbing;
}

:global([data-drag-preview] .session-item .title) {
  color: var(--fg);
}

.session-item.is-swept .session-card {
  background: var(--bg-selected);
}

@media (prefers-reduced-motion: reduce) {
  .session-card,
  .title {
    transition: none;
  }
}
</style>
