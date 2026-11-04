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
          :class="[variant, { active, 'is-placeholder': placeholder, renaming }]"
          :to="placeholder ? undefined : { name: 'session', params: { sessionId: session.id } }"
          draggable="false"
          @click="onCardClick"
          @dblclick="onCardDblclick"
          @pointerdown.left="onCardPointerDown"
          @dragstart.prevent
          @keydown="onCardKeydown"
        >
          <template v-if="variant === 'card'">
            <span class="meta-line">
              <span class="project-icon" aria-hidden="true">
                <FolderIcon :size="16" />
              </span>

              <span class="project-name">{{ projectName }}</span>

              <span v-if="!renaming" class="state-slot">
                <span class="state-mark" aria-hidden="true">
                  <SessionStateIcon v-if="glyphState" :state="glyphState" />
                  <span v-else class="time-label">{{ timeLabel }}</span>
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

              <Tooltip v-else :disabled="!titleOverflow">
                <TooltipTrigger as-child>
                  <span :ref="setTitleEl" class="title" @pointerenter="measureTitle">
                    {{ session.title }}
                  </span>
                </TooltipTrigger>

                <TooltipContent side="right" :side-offset="10" class="title-tooltip">
                  {{ session.title }}
                </TooltipContent>
              </Tooltip>
            </span>
          </template>

          <template v-else>
            <span class="project-icon" aria-hidden="true">
              <FolderIcon :size="16" />
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

            <Tooltip v-else :disabled="!titleOverflow">
              <TooltipTrigger as-child>
                <span :ref="setTitleEl" class="title" @pointerenter="measureTitle">
                  {{ session.title }}
                </span>
              </TooltipTrigger>

              <TooltipContent side="right" :side-offset="10" class="title-tooltip">
                {{ session.title }}
              </TooltipContent>
            </Tooltip>

            <span v-if="!renaming" class="state-slot">
              <span class="state-mark" aria-hidden="true">
                <SessionStateIcon v-if="glyphState" :state="glyphState" />
                <span v-else class="time-label">{{ timeLabel }}</span>
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
            </span>
          </template>
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

        <ContextMenuSeparator />

        <template v-if="settled">
          <ContextMenuItem @select="emit('unsettle', session.id)">
            <RestartIcon />
            {{ t("session.unsettle") }}
          </ContextMenuItem>
        </template>

        <template v-else>
          <ContextMenuItem @select="emit('settle', session.id)">
            <CheckCircleIcon />
            {{ t("session.settle") }}
          </ContextMenuItem>
        </template>

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
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from "vue"
import { RouterLink } from "vue-router"
import { useI18n } from "@i18n/index.js"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@components/ui/context-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import SessionStateIcon from "@features/session-nav/components/SessionStateIcon.vue"
import { sessionGlyph } from "@features/session-nav/lib/status-cycle.js"
import { formatRelativeTime, workspaceName } from "@features/session-nav/lib/format.js"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import {
  CheckCircleIcon,
  FolderIcon,
  MenuDotsIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  RestartIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    settled?: boolean
    state?: SidebarSessionState | undefined
    variant?: "card" | "slim"
    placeholder?: boolean
    dragging?: boolean
    draggable?: boolean
  }>(),
  {
    state: undefined,
    variant: "card",
    placeholder: false,
    dragging: false,
    draggable: false,
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
  dragStart: [event: PointerEvent]
}>()
const { t } = useI18n()
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const projectName = computed(() => (props.session.cwd ? workspaceName(props.session.cwd) : ""))
const glyphState = computed(() => sessionGlyph(props.session, props.state))
const timeLabel = computed(() => formatRelativeTime(props.session.updatedAt))
const titleEl = shallowRef<HTMLElement | null>(null)
const titleOverflow = shallowRef(false)

function setTitleEl(el: unknown): void {
  titleEl.value = el instanceof HTMLElement ? el : null
}

function measureTitle() {
  const el = titleEl.value
  titleOverflow.value = el ? el.scrollWidth > el.clientWidth + 1 : false
}

const renaming = ref(false)
const renameDraft = ref("")
const renameInput = shallowRef<HTMLInputElement | null>(null)

function setRenameInput(el: unknown): void {
  renameInput.value = el instanceof HTMLInputElement ? el : null
}

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
  emit("prime", props.session.id)

  if (!props.draggable) return
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
  window.removeEventListener("pointerup", onPointerUp)
  window.removeEventListener("pointercancel", onPointerUp)
}

// 按住未松手时行可能被卸载（过滤、折叠、删会话），监听器要跟着走。
onBeforeUnmount(onPointerUp)

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
  emit("open", props.session.id)
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
  display: flex;
  min-width: 0;
  width: 100%;
  border-radius: var(--radius-md);
  background: transparent;
  color: inherit;
  text-decoration: none;
  cursor: default;
  transition: background-color var(--duration-fast) var(--ease-hover);
}

.session-card.card {
  flex-direction: column;
  gap: var(--space-xxs);
  min-height: 60px;
  padding: var(--space-xs) 10px;
}

.session-card.slim {
  flex-direction: row;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding-inline: 10px;
}

.session-item:hover .session-card,
.session-card[data-state="open"],
.session-card.active {
  background: var(--glass-selected-bg);
}

.project-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--contrast-foreground-muted);
}

.meta-line {
  display: flex;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
  height: 20px;
}

.project-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-line {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 20px;
}

.title {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--contrast-foreground);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-hover);
}

.session-card.slim .title {
  flex: 1;
}

/* 行尾一格：常态放状态或时间，行被指到或聚焦时换成更多按钮。 */
.state-slot {
  position: relative;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  min-width: 20px;
  height: 20px;
  margin-inline-start: auto;
}

.state-mark {
  display: grid;
  place-items: center;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.time-label {
  color: var(--contrast-foreground-muted);
  font-size: var(--text-eyebrow);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-eyebrow--line-height);
  white-space: nowrap;
}

.session-item:hover .state-mark,
.session-item:focus-within .state-mark,
.session-item.is-menu-open .state-mark {
  opacity: 0;
}

.more-toggle {
  position: absolute;
  inset-inline-end: -4px;
  top: 50%;
  display: grid;
  place-items: center;
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
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
  background: var(--hover-strong);
  color: var(--contrast-foreground);
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: 21px;
  margin-block: -2px;
  padding: 0 var(--space-xxs);
  border: 0;
  border-radius: var(--radius-xs);
  outline: none;
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
  box-shadow: inset 0 0 0 1px var(--primary);
}

:global(.title-tooltip) {
  max-width: 320px !important;
}

@media (prefers-reduced-motion: reduce) {
  .session-card,
  .title,
  .state-mark,
  .more-toggle {
    transition: none;
  }
}
</style>
