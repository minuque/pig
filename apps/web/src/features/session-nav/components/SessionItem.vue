<template>
  <div
    class="session-item"
    :class="{
      'is-menu-open': menuOpen,
      'is-placeholder': placeholder,
      'is-swept': swept,
    }"
  >
    <ContextMenu :modal="false" @update:open="onMenuOpenChange">
      <HoverCard :disabled="placeholder || renaming || menuOpen || forkHover">
        <HoverCardTrigger>
          <template #render="{ props: card }">
            <ContextMenuTrigger v-bind="card">
              <template #render="{ props: part }">
                <component
                  v-bind="part"
                  :is="placeholder ? 'div' : RouterLink"
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
                  @dragstart.prevent
                  @keydown="onCardKeydown"
                >
                  <template v-if="variant === 'card'">
                    <span class="meta-line">
                      <span v-if="projectName" class="project-icon" aria-hidden="true">
                        <ProjectIcon class="project-mono" :path="session.cwd" fallback="monogram" />
                      </span>

                      <Tooltip v-if="pinned">
                        <TooltipTrigger>
                          <template #render="{ props: part }">
                            <button
                              v-bind="part"
                              type="button"
                              class="pin-toggle"
                              :aria-label="t('session.unpin')"
                              :disabled="placeholder"
                              @click.prevent.stop="emit('togglePinned', session.id)"
                              @pointerdown.stop
                            >
                              <PinIcon class="pin-on" />
                              <PinOffIcon class="pin-off" />
                            </button>
                          </template>
                        </TooltipTrigger>

                        <TooltipContent>{{ t("session.unpin") }}</TooltipContent>
                      </Tooltip>

                      <span class="project-name">{{ projectName }}</span>

                      <span v-if="!renaming" class="state-slot">
                        <span class="state-mark" aria-hidden="true">
                          <span v-if="startedAt !== undefined" class="working-status">
                            <CircleDashedIcon class="size-icon-lg working-icon" />
                            <span>{{ t("session.sectionWorking") }}</span>
                            <span class="working-elapsed">{{ elapsed }}</span>
                          </span>

                          <SessionStateIcon v-else-if="glyphState" :state="glyphState" />
                          <span v-else class="time-label">{{ timeLabel }}</span>
                        </span>

                        <button
                          v-if="!placeholder && startedAt === undefined"
                          class="row-action press-scale"
                          type="button"
                          :aria-label="settled ? t('session.unsettle') : t('session.settle')"
                          @click.prevent.stop="onRowAction"
                          @pointerdown.stop="onActionPointerDown"
                        >
                          <Undo2Icon v-if="settled" class="size-icon" />
                          <CheckIcon v-else class="size-icon" />

                          <span class="row-action-label">
                            {{ settled ? t("session.unsettle") : t("session.settle") }}
                          </span>
                        </button>
                      </span>
                    </span>

                    <span class="title-line">
                      <input
                        v-if="renaming"
                        :ref="setRenameInput"
                        v-model="renameDraft"
                        class="rename-input"
                        type="text"
                        :aria-label="t('session.rename')"
                        @click.stop
                        @keydown.enter.prevent="commitRename"
                        @keydown.escape.prevent="cancelRename"
                        @blur="commitRename"
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

                    <input
                      v-if="renaming"
                      :ref="setRenameInput"
                      v-model="renameDraft"
                      class="rename-input"
                      type="text"
                      :aria-label="t('session.rename')"
                      @click.stop
                      @keydown.enter.prevent="commitRename"
                      @keydown.escape.prevent="cancelRename"
                      @blur="commitRename"
                    />

                    <span v-else class="title">{{ session.title }}</span>

                    <span v-if="!renaming" class="state-slot">
                      <span class="state-mark" aria-hidden="true">
                        <SessionStateIcon v-if="glyphState" :state="glyphState" />
                        <span v-else class="time-label">{{ timeLabel }}</span>
                      </span>

                      <button
                        v-if="!placeholder"
                        class="row-action press-scale"
                        type="button"
                        :aria-label="settled ? t('session.unsettle') : t('session.settle')"
                        @click.prevent.stop="onRowAction"
                        @pointerdown.stop="onActionPointerDown"
                      >
                        <Undo2Icon v-if="settled" class="size-icon" />
                        <CheckIcon v-else class="size-icon" />
                      </button>
                    </span>
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

      <ContextMenuContent v-if="!placeholder" class="select-none">
        <template v-if="split">
          <ContextMenuItem @select="split.openToSide(session.id)">
            <Columns2Icon />
            {{ split.split.value ? t("split.openToOther") : t("split.openToSide") }}
          </ContextMenuItem>

          <ContextMenuSeparator />
        </template>

        <ContextMenuItem @select="startRename">
          <PenIcon />
          {{ t("session.rename") }}
        </ContextMenuItem>

        <ContextMenuItem @select="emit('togglePinned', session.id)">
          <PinOffIcon v-if="pinned" />
          <PinIcon v-else />
          {{ pinned ? t("session.unpin") : t("session.pin") }}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <template v-if="settled">
          <ContextMenuItem @select="emit('unsettle', session.id)">
            <RotateCcwIcon />
            {{ t("session.unsettle") }}
          </ContextMenuItem>
        </template>

        <template v-else>
          <ContextMenuItem @select="emit('settle', session.id)">
            <CircleCheckIcon />
            {{ t("session.settle") }}
          </ContextMenuItem>
        </template>

        <ContextMenuItem :disabled="startedAt !== undefined" @select="emit('archive', session.id)">
          <ArchiveIcon />
          {{ t("session.archive") }}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem color="danger" @select="deleteOpen = true">
          <TrashIcon />
          {{ t("session.deleteTitle") }}
        </ContextMenuItem>
      </ContextMenuContent>
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
import { computed, nextTick, ref, shallowRef, watch } from "vue"
import { useIntervalFn } from "@vueuse/core"
import { RouterLink } from "vue-router"
import { useI18n } from "@i18n/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@pig/ui/context-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { HoverCard, HoverCardTrigger } from "@pig/ui/hover-card"
import SessionRowMarks from "@features/session-nav/components/SessionRowMarks.vue"
import SessionHoverCard from "@features/session-nav/components/SessionHoverCard.vue"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import SessionStateIcon from "@features/session-nav/components/SessionStateIcon.vue"
import { sessionGlyph } from "@features/session-nav/lib/status-cycle.js"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import { formatRelativeTime, workspaceName } from "@features/session-nav/lib/format.js"
import { formatElapsed } from "@utils/time.js"
import type { SidebarRowFoot, SidebarSession } from "@features/session-nav/type.js"
import { trySplitView } from "@features/split-view/index.js"
import {
  ArchiveIcon,
  CircleCheckIcon,
  CheckIcon,
  Columns2Icon,
  CircleDashedIcon,
  PenIcon,
  PinIcon,
  PinOffIcon,
  RotateCcwIcon,
  TrashIcon,
  Undo2Icon,
  FolderGit2Icon,
  GitBranchIcon,
} from "@components/icons/index.js"

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
const { t } = useI18n()
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const projectName = computed(() => (props.session.cwd ? workspaceName(props.session.cwd) : ""))
const glyphState = computed(() => sessionGlyph(props.session, props.foot?.state))
const timeLabel = computed(() => formatRelativeTime(props.session.updatedAt))
const tick = shallowRef(Date.now())
const elapsed = computed(() =>
  props.startedAt === undefined
    ? ""
    : formatElapsed(tick.value - props.startedAt, { showMs: false }),
)
const clock = useIntervalFn(
  () => {
    tick.value = Date.now()
  },
  1_000,
  { immediate: false },
)

watch(
  () => props.startedAt,
  (startedAt) => {
    if (startedAt === undefined) {
      clock.pause()
      return
    }

    tick.value = Date.now()
    clock.resume()
  },
  { immediate: true },
)

const renaming = ref(false)
const renameDraft = ref("")
const renameInput = shallowRef<HTMLInputElement | null>(null)

function setRenameInput(el: unknown): void {
  renameInput.value = el instanceof HTMLInputElement ? el : null
}

async function startRename() {
  if (props.placeholder) return
  renameDraft.value = props.session.title
  renaming.value = true
  await nextTick()
  renameInput.value?.focus()
  renameInput.value?.select()
}

function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  const trimmed = renameDraft.value.trim()

  if (!trimmed || trimmed === props.session.title) return
  emit("rename", props.session.id, trimmed)
}

function cancelRename() {
  renaming.value = false
}

function onMenuOpenChange(open: boolean) {
  menuOpen.value = open
}

function isModifiedSessionClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function onCardPointerDown(event: PointerEvent) {
  if (props.placeholder) return

  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  emit("prime", props.session.id)

  if (renaming.value) event.stopPropagation()
}

function onActionPointerDown(event: PointerEvent) {
  if (event.button === 0 && !props.placeholder) emit("sweepStart", event)
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
  void startRename()
}

function onRowAction() {
  if (props.settled) emit("unsettle", props.session.id)
  else emit("settle", props.session.id)
}

function onCardKeydown(event: KeyboardEvent) {
  if (props.placeholder || event.key !== "F2") return
  event.preventDefault()
  void startRename()
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

.pin-toggle {
  display: inline-flex;
  flex: none;
  align-items: center;
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  background: transparent;
  color: var(--fg-secondary);
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-out);
}

.pin-toggle :deep(svg) {
  inline-size: var(--icon-sm);
  block-size: var(--icon-sm);
}

.pin-toggle .pin-off,
.pin-toggle:is(:hover, :focus-visible):not(:disabled) .pin-on {
  display: none;
}

.pin-toggle:is(:hover, :focus-visible):not(:disabled) .pin-off {
  display: block;
}

.pin-toggle:is(:hover, :focus-visible):not(:disabled) {
  color: var(--fg);
}

.pin-toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.pin-toggle:disabled {
  cursor: default;
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
  border-radius: calc(var(--radius-control) / 2);
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

.state-slot {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  min-width: var(--control-2xs);
  height: var(--control-2xs);
  margin-inline-start: auto;
}

.state-mark {
  display: grid;
  place-items: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.time-label {
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.working-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-2xs);
  color: var(--info-text);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

.working-icon {
  flex: none;
}

.working-elapsed {
  font-variant-numeric: tabular-nums;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept)
  .state-slot:has(.row-action)
  .state-mark {
  position: absolute;
  inset-inline-end: 0;
  opacity: 0;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept) .row-action {
  position: relative;
  inset: auto;
  margin-inline-end: calc(var(--space-xs) * -1);
  translate: none;
}

.session-item:is(:hover, :focus-within, .is-menu-open, .is-swept) .session-card.slim .row-action {
  margin-inline-end: -2px;
}

.row-action {
  position: absolute;
  inset-inline-end: calc(var(--space-xs) * -1);
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  padding-block: 2px;
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
  translate: 0 -50%;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.session-card.slim .row-action {
  inset-inline-end: -2px;
  padding-inline: 2px;
}

.session-item:hover .row-action,
.session-item:focus-within .row-action,
.row-action:focus-visible,
.session-item.is-menu-open .row-action {
  opacity: 1;
  pointer-events: auto;
}

.row-action:hover,
.row-action:focus-visible {
  color: var(--fg);
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

.session-item.is-swept .state-mark {
  opacity: 0;
}

.session-item.is-swept .row-action {
  color: var(--fg);
  opacity: 1;
}

:global([data-drag-preview] .session-item .state-mark),
:global([data-drag-preview] .session-item .row-action) {
  opacity: 0;
  pointer-events: none;
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: calc(var(--control-2xs) + 1px);
  margin-block: -2px;
  padding: 0 var(--space-2xs);
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  outline: none;
  background: var(--bg-muted);
  color: var(--fg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  box-shadow: inset 0 0 0 1px var(--accent-solid);
}

@media (prefers-reduced-motion: reduce) {
  .session-card,
  .title,
  .state-mark,
  .row-action {
    transition: none;
  }
}
</style>
