<template>
  <div
    class="session-item"
    :class="{ 'is-menu-open': menuOpen, 'is-placeholder': placeholder, selected }"
  >
    <ContextMenu :modal="false" :press-open-delay="500" @update:open="onMenuOpenChange">
      <ContextMenuTrigger as-child>
        <component
          :is="placeholder ? 'div' : RouterLink"
          class="session-card"
          :class="{ active, 'is-placeholder': placeholder }"
          :to="placeholder ? undefined : { name: 'session', params: { sessionId: session.id } }"
          @click="onCardClick"
          @pointerdown="onCardPointerDown"
          @keydown="onCardKeydown"
          @contextmenu="onCardContextMenu"
        >
          <div class="meta-line">
            <span class="grip" aria-hidden="true"></span>

            <span class="proj-icon" aria-hidden="true">
              <span v-if="monoValue" class="proj-mono" :style="monoStyle">{{ monoValue }}</span>
              <span v-else-if="emojiValue" class="proj-emoji">{{ emojiValue }}</span>
              <component v-else :is="projectIcon" :size="14" :style="iconStyle" />
            </span>

            <span class="proj-name">{{ projectName }}</span>

            <span class="meta-slot" aria-hidden="true">
              <PinBoldIcon v-if="pinned" :size="12" class="meta-pin" />
            </span>

            <span class="status-slot">
              <span
                v-if="stateIcon"
                class="state-icon"
                :class="state"
                role="img"
                :aria-label="stateLabel"
              >
                <component :is="stateIcon" :size="13" />
                <span class="state-text">{{ stateLabel }}</span>
              </span>

              <span
                v-else-if="session.draft"
                class="state-icon draft"
                role="img"
                :aria-label="t('session.draft')"
              >
                <PenIcon :size="12" />
              </span>

              <time
                v-else-if="session.updatedAt"
                class="session-time"
                :datetime="new Date(session.updatedAt).toISOString()"
              >
                {{ relativeTime }}
              </time>
            </span>
          </div>

          <div class="title-line">
            <span class="title">{{ session.title }}</span>

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

        <ContextMenuItem @select="emit('projectSettings', projectName)">
          <SettingsMinimalisticIcon />
          {{ t("session.projectSettings") }}
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

    <SessionItemRename
      v-if="!placeholder"
      v-model:open="renameOpen"
      :title="session.title"
      @confirm="confirmRename"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, shallowRef } from "vue"
import { RouterLink } from "vue-router"
import { useI18n } from "@i18n/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { useNav, workspaceName } from "@features/session-nav/index.js"
import { formatDuration, formatRelativeTime } from "@features/session-nav/lib/format.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import SessionItemRename from "@features/session-nav/components/SessionItemRename.vue"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import {
  CheckCircleIcon,
  CircleDashedIcon,
  DangerCircleIcon,
  FolderIcon,
  MenuDotsIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  SettingsMinimalisticIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"
import { readJson } from "@utils/storage.js"
import { CodeSquareIcon } from "@solar-icons/vue/linear/code-square"
import { MonitorIcon } from "@solar-icons/vue/linear/monitor"
import { StarsMinimalisticIcon } from "@solar-icons/vue/linear/stars-minimalistic"
import { Book2Icon } from "@solar-icons/vue/linear/book-2"
import { GlobeIcon } from "@solar-icons/vue/linear/globe"
import { DatabaseIcon } from "@solar-icons/vue/linear/database"
import { BotIcon } from "@solar-icons/vue/linear/bot"
import { PhoneIcon } from "@solar-icons/vue/linear/phone"
import { RocketIcon } from "@solar-icons/vue/linear/rocket"
import { TestTubeIcon } from "@solar-icons/vue/linear/test-tube"
import { ShieldIcon } from "@solar-icons/vue/linear/shield"
import { GameboyIcon } from "@solar-icons/vue/linear/gameboy"
import { MusicNoteIcon } from "@solar-icons/vue/linear/music-note"
import { GalleryIcon } from "@solar-icons/vue/linear/gallery"
import { GitBranchIcon } from "@solar-icons/vue/linear/git-branch"
import { ToolboxIcon } from "@solar-icons/vue/linear/toolbox"
import { BoxIcon } from "@solar-icons/vue/linear/box"
import { StarIcon } from "@solar-icons/vue/linear/star"
import { HeartIcon } from "@solar-icons/vue/linear/heart"
import { LeafIcon } from "@solar-icons/vue/linear/leaf"
import { BoltIcon } from "@solar-icons/vue/linear/bolt"
import type { Component } from "vue"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    selected?: boolean
    state?: SidebarSessionState | undefined
    runningSince?: number | undefined
    placeholder?: boolean
    now: number
  }>(),
  {
    state: undefined,
    runningSince: undefined,
    placeholder: false,
  },
)
const emit = defineEmits<{
  navigate: []
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  projectSettings: [project: string]
  toggleSelect: [id: string]
  rangeSelect: [id: string]
}>()
const { t } = useI18n()
const { openSession, primeSession } = useNav()
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const renameOpen = shallowRef(false)
const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))
const projectName = computed(() =>
  props.session.cwd ? workspaceName(props.session.cwd) : t("session.noProject"),
)
const customIcon = computed(() => loadProjIcons()[projectName.value])
const projectIcon = computed(() => {
  const c = customIcon.value

  if (c?.kind === "icon" && ICON_COMPONENTS[c.value]) return ICON_COMPONENTS[c.value]
  return FolderIcon
})
const iconStyle = computed(() => {
  const c = customIcon.value
  return c?.kind === "icon" ? { color: c.color } : undefined
})
const emojiValue = computed(() =>
  customIcon.value?.kind === "emoji" ? customIcon.value.value : undefined,
)
const monoValue = computed(() =>
  customIcon.value?.kind === "monogram" ? customIcon.value.value : undefined,
)
const monoStyle = computed(() => {
  const c = customIcon.value
  return c?.kind === "monogram" ? { background: c.color } : undefined
})
const ICON_COMPONENTS: Record<string, Component> = {
  code: CodeSquareIcon,
  terminal: MonitorIcon,
  globe: GlobeIcon,
  database: DatabaseIcon,
  robot: BotIcon,
  stars: StarsMinimalisticIcon,
  phone: PhoneIcon,
  monitor: MonitorIcon,
  rocket: RocketIcon,
  book: Book2Icon,
  flask: TestTubeIcon,
  shield: ShieldIcon,
  game: GameboyIcon,
  music: MusicNoteIcon,
  image: GalleryIcon,
  git: GitBranchIcon,
  wrench: ToolboxIcon,
  box: BoxIcon,
  star: StarIcon,
  heart: HeartIcon,
  leaf: LeafIcon,
  bolt: BoltIcon,
}

type ProjIconKind = "icon" | "emoji" | "monogram"

interface ProjIcon {
  kind: ProjIconKind
  value: string
  color: string
}

function loadProjIcons(): Record<string, ProjIcon> {
  return readJson<Record<string, ProjIcon>>("pig.projIcons") ?? {}
}

const STATE_ICONS = { running: CircleDashedIcon, unread: CheckCircleIcon, error: DangerCircleIcon }
const STATE_LABELS = {
  running: t("session.running"),
  unread: t("session.done"),
  error: t("session.failed"),
}
const stateIcon = computed(() => (props.state ? STATE_ICONS[props.state] : undefined))
const stateLabel = computed(() => {
  if (!props.state) return undefined

  if (props.state === "running" && props.runningSince != null)
    return `${t("session.running")} ${formatDuration(props.runningSince, props.now)}`
  return STATE_LABELS[props.state]
})

function onMenuOpenChange(open: boolean) {
  menuOpen.value = open
}

function isModifiedSessionClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function onCardPointerDown(event: PointerEvent) {
  if (props.placeholder) return

  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  primeSession(props.session.id)
}

function onCardClick(event: MouseEvent) {
  if (props.placeholder || menuOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    return
  }

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    emit("toggleSelect", props.session.id)
    return
  }

  if (event.shiftKey) {
    event.preventDefault()
    emit("rangeSelect", props.session.id)
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
  event.preventDefault()
  event.stopPropagation()
}

function onCardKeydown(event: KeyboardEvent) {
  if (props.placeholder) return

  if (event.key === "F2") {
    event.preventDefault()
    startRename()
    return
  }

  if (event.key !== "F10" || !event.shiftKey) return
  event.preventDefault()
  const el = event.currentTarget

  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  openContextMenuAt(el, rect.left + 8, rect.top + 8)
}

function startRename() {
  renameOpen.value = true
}

function confirmRename(name: string) {
  renameOpen.value = false
  const trimmed = name.trim()

  if (!trimmed || trimmed === props.session.title) return
  emit("rename", props.session.id, trimmed)
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
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  width: 100%;
  min-width: 0;
  padding: 7px var(--spacing-xs);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  line-height: var(--text-caption--line-height);
  text-decoration: none;
  cursor: default;
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.session-item:hover .session-card,
.session-card[data-state="open"] {
  background: var(--sidebar-hover);
}

.session-card.active,
.session-item:hover .session-card.active,
.session-card.active[data-state="open"] {
  background: var(--sidebar-selected);
}

.session-item.selected .session-card {
  background: var(--sidebar-selected);
  box-shadow: inset 0 0 0 1px var(--primary);
}

.meta-line {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  font-size: var(--text-eyebrow);
  color: var(--contrast-foreground-faint);
  line-height: var(--text-eyebrow--line-height);
  position: relative;
}

.grip {
  position: absolute;
  inset-inline-start: calc(-1 * var(--spacing-xs));
  top: 0;
  bottom: 0;
  width: var(--spacing-xs);
  cursor: grab;
}

.proj-icon {
  display: grid;
  place-items: center;
  flex: none;
  color: var(--contrast-foreground-faint);
}

.proj-mono {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  border-radius: var(--radius-xs);
  color: var(--primary-foreground);
  font: 700 8px/1 var(--font-mono);
}

.proj-emoji {
  font-size: 12px;
  line-height: 1;
}

.proj-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.meta-slot {
  flex: none;
  display: grid;
  place-items: center;
  width: var(--size-icon);
  height: var(--size-icon);
}

.meta-pin {
  color: var(--contrast-foreground-faint);
}

.status-slot {
  display: grid;
  flex: none;
  align-items: center;
  justify-items: end;
  min-width: 20px;
  max-width: 45%;
  min-height: 14px;
}

.state-icon,
.session-time {
  grid-area: 1 / 1;
}

.state-icon {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
}

.state-icon.running {
  color: var(--state-working);
}

.state-icon.unread {
  color: var(--success);
}

.state-icon.error {
  color: var(--destructive);
}

.state-icon.draft {
  color: var(--warning);
}

.state-text {
  font-weight: var(--font-weight-medium);
}

.session-time {
  display: flex;
  align-items: center;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-eyebrow--line-height);
  white-space: nowrap;
}

.title-line {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.more-toggle {
  display: grid;
  place-items: center;
  flex: none;
  margin-inline: calc(var(--icon-button-pad) * -1);
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
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
  color: var(--contrast-foreground);
}

@media (hover: none) {
  .more-toggle {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-card {
    transition: none;
  }
}
</style>
