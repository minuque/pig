<template>
  <div
    class="session-item"
    :class="{ 'is-menu-open': menuOpen, 'is-placeholder': placeholder, 'is-dragging': dragging }"
  >
    <ContextMenu :modal="false" :press-open-delay="500" @update:open="onMenuOpenChange">
      <ContextMenuTrigger as-child>
        <component
          :is="placeholder ? 'div' : RouterLink"
          class="session-card"
          :class="{ active, 'is-placeholder': placeholder, renaming }"
          :to="placeholder ? undefined : { name: 'session', params: { sessionId: session.id } }"
          draggable="false"
          @click="onCardClick"
          @dblclick="onCardDblclick"
          @pointerdown.left="onCardPointerDown"
          @dragstart.prevent
          @keydown="onCardKeydown"
        >
          <span class="corner">
            <span class="corner-rest">
              <time
                v-if="session.updatedAt"
                class="session-time"
                :datetime="new Date(session.updatedAt).toISOString()"
              >
                {{ relativeTime }}
              </time>
            </span>
          </span>

          <span class="title-line">
            <span v-if="stateIcon || session.draft" class="state-slot" aria-hidden="true">
              <component
                :is="stateIcon"
                v-if="stateIcon"
                :size="12"
                :class="['state-glyph', state, { 'motion-spin': state === 'running' }]"
              />

              <span v-else class="state-dot draft"></span>
            </span>

            <span class="proj-icon" aria-hidden="true">
              <span v-if="monoValue" class="proj-mono" :style="monoStyle">{{ monoValue }}</span>
              <span v-else-if="emojiValue" class="proj-emoji">{{ emojiValue }}</span>
              <component v-else :is="projectIcon" :size="13" :style="iconStyle" />
            </span>

            <input
              v-if="renaming"
              ref="renameInput"
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
          </span>

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
                @pointerdown.stop
              >
                <MenuDotsIcon class="size-icon" />
              </button>
            </TooltipTrigger>

            <TooltipContent>{{ t("common.more") }}</TooltipContent>
          </Tooltip>
        </component>
      </ContextMenuTrigger>

      <ContextMenuContent v-if="!placeholder" class="select-none">
        <ContextMenuItem @select="startRename">
          <PenIcon />
          {{ t("session.rename") }}
        </ContextMenuItem>

        <ContextMenuItem @select="emit('togglePinned', session.id)">
          <PinBoldIcon v-if="pinned" />
          <PinIcon v-else />
          {{ pinned ? t("session.unpin") : t("session.pin") }}
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
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useTemplateRef } from "vue"
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
import { formatRelativeTime } from "@features/session-nav/lib/format.js"
import { loadProjIcons, projectIconComponent } from "@features/session-nav/lib/project-icon.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import {
  CheckCircleIcon,
  CircleDashedIcon,
  DangerCircleIcon,
  MenuDotsIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  SettingsMinimalisticIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    state?: SidebarSessionState | undefined
    placeholder?: boolean
    dragging?: boolean
    now: number
  }>(),
  {
    state: undefined,
    placeholder: false,
    dragging: false,
  },
)
const emit = defineEmits<{
  navigate: []
  togglePinned: [id: string]
  rename: [id: string, name: string]
  delete: [id: string]
  projectSettings: [project: string]
  dragStart: [event: PointerEvent]
}>()
const { t } = useI18n()
const { openSession, primeSession } = useNav()
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const relativeTime = computed(() => formatRelativeTime(props.session.updatedAt, props.now))
const projectName = computed(() =>
  props.session.cwd ? workspaceName(props.session.cwd) : t("session.noProject"),
)
const customIcon = computed(() => loadProjIcons()[projectName.value])
const projectIcon = computed(() => projectIconComponent(customIcon.value))
const iconStyle = computed(() => {
  const custom = customIcon.value
  return custom?.kind === "icon" ? { color: custom.color } : undefined
})
const emojiValue = computed(() =>
  customIcon.value?.kind === "emoji" ? customIcon.value.value : undefined,
)
const monoValue = computed(() =>
  customIcon.value?.kind === "monogram" ? customIcon.value.value : undefined,
)
const monoStyle = computed(() => {
  const custom = customIcon.value
  return custom?.kind === "monogram" ? { background: custom.color } : undefined
})
const STATE_ICONS = { running: CircleDashedIcon, unread: CheckCircleIcon, error: DangerCircleIcon }
const stateIcon = computed(() => (props.state ? STATE_ICONS[props.state] : undefined))
const renaming = ref(false)
const renameDraft = ref("")
const renameInput = useTemplateRef<HTMLInputElement>("renameInput")
const pointerDownPos = shallowRef<{ x: number; y: number } | undefined>(undefined)
let dragPending = false
let didDrag = false

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
  primeSession(props.session.id)
  pointerDownPos.value = { x: event.clientX, y: event.clientY }
  dragPending = true
  window.addEventListener("pointermove", onPointerMove)
  window.addEventListener("pointerup", onPointerUp, { once: true })
  window.addEventListener("pointercancel", onPointerUp, { once: true })
}

function onPointerMove(event: PointerEvent) {
  if (!dragPending || !pointerDownPos.value) return
  const dx = event.clientX - pointerDownPos.value.x
  const dy = event.clientY - pointerDownPos.value.y

  if (Math.hypot(dx, dy) < 5) return
  dragPending = false
  didDrag = true
  emit("dragStart", event)
  window.removeEventListener("pointermove", onPointerMove)
}

function onPointerUp() {
  dragPending = false
  pointerDownPos.value = undefined
  window.removeEventListener("pointermove", onPointerMove)
}

function onCardClick(event: MouseEvent) {
  if (didDrag) {
    didDrag = false
    event.preventDefault()
    event.stopPropagation()
    return
  }

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

function onCardDblclick(event: MouseEvent) {
  if (props.placeholder || isModifiedSessionClick(event)) return
  event.preventDefault()
  void startRename()
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

function onCardKeydown(event: KeyboardEvent) {
  if (props.placeholder) return

  if (event.key === "F2") {
    event.preventDefault()
    void startRename()
    return
  }

  if (event.key !== "F10" || !event.shiftKey) return
  event.preventDefault()
  const el = event.currentTarget

  if (!(el instanceof HTMLElement)) return
  const rect = el.getBoundingClientRect()
  openContextMenuAt(el, rect.left + 8, rect.top + 8)
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

.session-item.is-dragging .session-card {
  opacity: 0.4;
}

.session-card {
  position: relative;
  display: grid;
  grid-template-areas: "title title";
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: 17px;
  gap: 2px var(--spacing-xs);
  width: 100%;
  min-width: 0;
  padding: 6px var(--spacing-xs);
  padding-inline-end: calc(var(--spacing-xs) + 22px);
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  line-height: var(--text-caption--line-height);
  text-decoration: none;
  cursor: default;
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.session-card::before {
  content: "";
  position: absolute;
  inset-inline-start: 2px;
  top: 50%;
  width: 2px;
  height: 0;
  border-radius: var(--radius-full);
  background: var(--primary);
  translate: 0 -50%;
  transition: height var(--duration-fast) var(--ease-out);
}

.session-card.active::before {
  height: 14px;
}

.session-item:hover .session-card,
.session-card[data-state="open"] {
  background: var(--glass-selected-bg);
}

.session-card.active,
.session-item:hover .session-card.active,
.session-card.active[data-state="open"] {
  background: var(--glass-selected-bg);
}

.corner {
  position: absolute;
  inset-inline-end: calc(var(--spacing-xs) + 22px);
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: end;
  min-width: 20px;
  min-height: 14px;
}

.corner-rest {
  display: inline-flex;
  align-items: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.session-item:hover .corner-rest,
.session-item:focus-within .corner-rest,
.session-item.is-menu-open .corner-rest {
  opacity: 0;
}

.state-slot {
  display: grid;
  flex: none;
  place-items: center;
  width: 13px;
  height: 13px;
}

.state-dot {
  display: block;
  width: 5px;
  height: 5px;
  border-radius: var(--radius-full);
  background: var(--contrast-foreground-faint);
  opacity: 0;
}

.state-dot.draft {
  background: var(--warning);
  opacity: 1;
}

.state-glyph {
  display: block;
}

.state-glyph.running {
  color: var(--state-working);
}

.state-glyph.unread {
  color: var(--success);
}

.state-glyph.error {
  color: var(--destructive);
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

.more-toggle {
  position: absolute;
  inset-inline-end: var(--spacing-xxs);
  top: 50%;
  display: grid;
  place-items: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
  translate: 0 -50%;
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

.title-line {
  grid-area: title;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-width: 0;
}

.proj-icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 14px;
  height: 14px;
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

.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  opacity: 0.8;
  white-space: nowrap;
  transition: opacity var(--duration-fast) var(--ease-hover);
  -webkit-mask-image: linear-gradient(to right, black calc(100% - 20px), transparent);
  mask-image: linear-gradient(to right, black calc(100% - 20px), transparent);
}

.session-item:hover .title,
.session-card.active .title {
  opacity: 1;
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: 21px;
  margin-block: -2px;
  padding: 0 var(--spacing-xxs);
  border: 0;
  border-radius: var(--radius-xs);
  outline: none;
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  box-shadow: inset 0 0 0 1px var(--primary);
}

@media (hover: none) {
  .more-toggle {
    opacity: 1;
    pointer-events: auto;
  }

  .corner-rest {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .session-card,
  .session-card::before,
  .title,
  .corner-rest,
  .more-toggle {
    transition: none;
  }
}
</style>
