<template>
  <div class="session-item" :class="{ 'is-menu-open': menuOpen, 'is-placeholder': placeholder }">
    <Tooltip v-if="!placeholder && !renaming && !showPath">
      <TooltipTrigger as-child>
        <button
          class="pin-toggle press-scale"
          type="button"
          :aria-label="pinned ? t('session.unpin') : t('session.pin')"
          :aria-pressed="pinned"
          @click.stop="emit('togglePinned', session.id)"
        >
          <PinBoldIcon v-if="pinned" class="size-icon" />
          <PinIcon v-else class="size-icon" />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ pinned ? t("session.unpin") : t("session.pin") }}</TooltipContent>
    </Tooltip>

    <ContextMenu :modal="false" :press-open-delay="500" @update:open="onMenuOpenChange">
      <ContextMenuTrigger as-child>
        <component
          :is="renaming || placeholder ? 'div' : RouterLink"
          class="session-card"
          :class="{ active, 'show-path': showPath, 'is-placeholder': placeholder }"
          :to="
            renaming || placeholder
              ? undefined
              : { name: 'session', params: { sessionId: session.id } }
          "
          @click="onCardClick"
          @keydown="onCardKeydown"
          @contextmenu="onCardContextMenu"
        >
          <div class="card-line">
            <span v-if="!renaming && !showPath" class="pin-slot" aria-hidden="true"></span>

            <input
              v-if="renaming"
              ref="nameInput"
              v-model="draft"
              class="rename-input"
              @click.stop
              @keydown.enter.prevent="commitRename"
              @keydown.escape.prevent="cancelRename"
              @blur="commitRename"
            />

            <span v-else class="title">{{ session.title }}</span>

            <span v-if="!renaming" class="trail-slot">
              <span
                v-if="stateIcon"
                class="state-icon"
                :class="state"
                role="img"
                :aria-label="stateLabel"
              >
                <component
                  :is="stateIcon"
                  :size="14"
                  :class="{ 'animate-spin motion-reduce:animate-none': state === 'running' }"
                />
              </span>

              <span
                v-else-if="showPath"
                class="status-ring"
                :class="{ active }"
                :role="active ? 'img' : undefined"
                :aria-hidden="active ? undefined : true"
                :aria-label="active ? t('session.current') : undefined"
              ></span>

              <span v-else-if="dirTag" class="session-dir" :title="session.cwd">
                {{ dirTag }}
              </span>

              <time
                v-else-if="session.updatedAt"
                class="session-time"
                :datetime="new Date(session.updatedAt).toISOString()"
              >
                {{ relativeTime }}
              </time>

              <Tooltip v-if="!placeholder">
                <TooltipTrigger as-child>
                  <button
                    class="more-toggle press-scale"
                    type="button"
                    :aria-label="t('common.more')"
                    aria-haspopup="menu"
                    :aria-expanded="menuOpen"
                    @click.prevent.stop="openSessionMenu"
                    @contextmenu.prevent.stop="openSessionMenu"
                  >
                    <MenuDotsIcon class="size-icon" />
                  </button>
                </TooltipTrigger>

                <TooltipContent>{{ t("common.more") }}</TooltipContent>
              </Tooltip>
            </span>
          </div>

          <div v-if="showPath && session.cwd" class="path-line">
            <FolderIcon class="path-icon" :size="14" aria-hidden="true" />
            <span class="path-text">{{ session.cwd }}</span>
          </div>
        </component>
      </ContextMenuTrigger>

      <ContextMenuContent v-if="!placeholder" class="select-none">
        <ContextMenuItem @select="emit('togglePinned', session.id)">
          <PinBoldIcon v-if="pinned" />
          <PinIcon v-else />
          {{ pinned ? t("session.unpin") : t("session.pin") }}
        </ContextMenuItem>

        <ContextMenuItem @select="startRename">
          <PenIcon />
          {{ t("session.rename") }}
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem variant="destructive" @select="deleteOpen = true">
          <TrashBinMinimalisticIcon />
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
import { computed, nextTick, ref, shallowRef } from "vue"
import { RouterLink } from "vue-router"
import { useI18n } from "@i18n/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { useNav } from "@features/session-nav/index.js"
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import {
  CheckCircleIcon,
  DangerCircleIcon,
  FolderIcon,
  LoaderIcon,
  MenuDotsIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    showPath?: boolean
    dirTag?: string | undefined
    state?: SidebarSessionState | undefined
    placeholder?: boolean
    now: number
  }>(),
  {
    showPath: false,
    dirTag: undefined,
    state: undefined,
    placeholder: false,
  },
)
const emit = defineEmits<{
  navigate: []
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
}>()
const { t } = useI18n()
const { openSession } = useNav()
const renaming = ref(false)
const draft = ref("")
const nameInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))
const STATE_ICONS = { running: LoaderIcon, unread: CheckCircleIcon, error: DangerCircleIcon }
const STATE_LABELS = {
  running: t("session.running"),
  unread: t("session.runningUnread"),
  error: t("session.runningError"),
}
const stateIcon = computed(() =>
  props.state && !renaming.value ? STATE_ICONS[props.state] : undefined,
)
const stateLabel = computed(() => (props.state ? STATE_LABELS[props.state] : undefined))

function onMenuOpenChange(open: boolean) {
  menuOpen.value = open
}

function isModifiedSessionClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function onCardClick(event: MouseEvent) {
  if (props.placeholder || menuOpen.value || renaming.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  emit("navigate")

  if (isModifiedSessionClick(event)) return
  event.preventDefault()
  openSession(props.session.id)
}

function openContextMenuAt(target: HTMLElement, clientX: number, clientY: number) {
  target.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      view: window,
    }),
  )
}

function openSessionMenu(event: MouseEvent) {
  const button = event.currentTarget
  const card = button instanceof HTMLElement ? button.closest(".session-card") : null

  if (!(button instanceof HTMLElement) || !(card instanceof HTMLElement)) return
  const rect = button.getBoundingClientRect()
  openContextMenuAt(card, rect.left, rect.bottom)
}

function onCardContextMenu(event: MouseEvent) {
  if (!props.placeholder) return
  event.preventDefault()
  event.stopPropagation()
}

function onCardKeydown(event: KeyboardEvent) {
  if (props.placeholder) return

  if (event.key !== "F10" || !event.shiftKey) return
  event.preventDefault()
  const el = event.currentTarget

  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  openContextMenuAt(el, rect.left + 8, rect.top + 8)
}

function startRename() {
  draft.value = props.session.title
  renaming.value = true
  void nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function cancelRename() {
  renaming.value = false
}

function commitRename() {
  if (!renaming.value) return
  renaming.value = false
  const name = draft.value.trim()

  if (!name || name === props.session.title) return
  emit("rename", props.session.id, name)
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
  align-items: center;
  width: 100%;
  height: var(--size-nav-rail);
  min-width: 0;
  padding-inline: var(--spacing-xs);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  line-height: 0;
  text-decoration: none;
}

.session-card.show-path {
  flex-direction: column;
  align-items: stretch;
  height: auto;
  padding: 6px var(--spacing-xs);
  line-height: var(--text-caption--line-height);
}

.session-item:hover .session-card,
.session-card[data-state="open"] {
  background: var(--interaction-hover);
}

.session-card.active,
.session-item:hover .session-card.active,
.session-card.active[data-state="open"] {
  background: var(--interaction-selected);
}

.card-line {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  width: 100%;
  height: 100%;
  line-height: 0;
}

.session-card.show-path .card-line {
  height: auto;
  min-height: calc(var(--text-caption) * var(--text-caption--line-height));
}

.pin-slot {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.pin-toggle {
  position: absolute;
  z-index: 1;
  inset-inline-start: calc(var(--spacing-xs) - var(--icon-button-pad));
  inset-block: 0;
  display: grid;
  place-items: center;
  width: calc(var(--size-icon) + var(--icon-button-pad) * 2);
  height: calc(var(--size-icon) + var(--icon-button-pad) * 2);
  margin-block: auto;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-smooth);
}

.session-item:hover .pin-toggle,
.pin-toggle:focus-visible {
  opacity: 1;
  pointer-events: auto;
}

.pin-toggle:hover,
.pin-toggle:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

.trail-slot {
  display: grid;
  flex: none;
  align-items: center;
  justify-items: end;
  min-width: var(--size-icon);
  min-height: var(--size-icon);
}

.state-icon,
.session-time,
.session-dir,
.status-ring,
.more-toggle {
  grid-area: 1 / 1;
}

.more-toggle {
  display: grid;
  place-items: center;
  margin-inline: calc(var(--icon-button-pad) * -1);
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-muted);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-item:hover .more-toggle,
.session-item:focus-within .more-toggle,
.more-toggle:focus-visible,
.session-item.is-menu-open .more-toggle {
  opacity: 1;
  pointer-events: auto;
}

.more-toggle:hover,
.more-toggle:focus-visible {
  background: var(--hover-quiet);
  color: var(--ink);
}

.status-ring {
  justify-self: end;
  align-self: center;
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--ink-faint);
  transition: opacity var(--duration-fast) var(--ease-out);
}

.status-ring.active {
  background: var(--primary);
  box-shadow: none;
}

.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--ink);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.path-line {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  margin-block-start: var(--spacing-xxs);
}

.path-icon {
  flex: none;
  color: var(--ink-muted);
}

.path-text {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-icon {
  display: flex;
  align-items: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.state-icon.running {
  color: var(--primary);
}

.state-icon.unread {
  color: var(--success);
}

.state-icon.error {
  color: var(--danger);
}

.session-time,
.session-dir {
  position: relative;
  display: flex;
  align-items: center;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
  text-align: end;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-time {
  font-variant-numeric: tabular-nums;
}

.session-dir {
  max-width: 96px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item:hover .session-time,
.session-item:hover .state-icon,
.session-item:hover .session-dir,
.session-item:hover .status-ring,
.session-item:focus-within .session-time,
.session-item:focus-within .state-icon,
.session-item:focus-within .session-dir,
.session-item:focus-within .status-ring,
.session-item.is-menu-open .session-time,
.session-item.is-menu-open .state-icon,
.session-item.is-menu-open .session-dir,
.session-item.is-menu-open .status-ring {
  opacity: 0;
  pointer-events: none;
}

@media (hover: none) {
  .more-toggle {
    opacity: 1;
    pointer-events: auto;
  }

  .session-time,
  .state-icon,
  .session-dir,
  .status-ring {
    opacity: 0;
    pointer-events: none;
  }
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: 100%;
  margin: 0;
  padding: 0 var(--spacing-xxs);
  border: 0;
  border-radius: var(--radius-xs);
  background: var(--interaction-hover);
  color: var(--ink);
  caret-color: var(--primary);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-caption--line-height);
  outline: none;
  box-shadow: inset 0 0 0 1px var(--primary);
  user-select: text;
}

.session-card.show-path .rename-input {
  height: calc(var(--text-caption) * var(--text-caption--line-height));
}

.rename-input::selection {
  background: var(--selection-bg);
  color: var(--ink);
}
</style>
