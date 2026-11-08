<template>
  <div
    class="session-item"
    :class="{
      'is-menu-open': menuOpen,
      'is-placeholder': placeholder,
      'is-dragging': dragging,
      'is-swept': swept,
    }"
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
                <PinBoldIcon v-if="pinned" :size="16" />

                <Badge v-else-if="projectName" class="project-mono" variant="soft" color="gray">
                  {{ projectMonogram(projectName) }}
                </Badge>
              </span>

              <span class="project-name">{{ projectName }}</span>

              <span v-if="!renaming" class="state-slot">
                <span class="state-mark" aria-hidden="true">
                  <span v-if="startedAt !== undefined" class="working-status">
                    <CircleDashedIcon :size="16" class="working-icon" />
                    <span>{{ t("session.sectionWorking") }}</span>
                    <span class="working-elapsed">{{ elapsed }}</span>
                  </span>

                  <SessionStateIcon v-else-if="glyphState" :state="glyphState" />
                  <span v-else class="time-label">{{ timeLabel }}</span>
                </span>

                <span v-if="verb" class="drop-verb">
                  <component :is="verb.icon" class="size-icon" />
                  {{ verb.label }}
                </span>

                <button
                  v-if="!placeholder"
                  class="row-action press-scale"
                  type="button"
                  :aria-label="settled ? t('session.unsettle') : t('session.settle')"
                  @click.prevent.stop="onRowAction"
                  @pointerdown.stop="onActionPointerDown"
                >
                  <UndoLeftRoundIcon v-if="settled" class="size-icon" />
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
              <Badge v-if="projectName" class="project-mono" variant="soft" color="gray">
                {{ projectMonogram(projectName) }}
              </Badge>
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

              <span v-if="verb" class="drop-verb">
                <component :is="verb.icon" class="size-icon" />
                {{ verb.label }}
              </span>

              <button
                v-if="!placeholder"
                class="row-action press-scale"
                type="button"
                :aria-label="settled ? t('session.unsettle') : t('session.settle')"
                @click.prevent.stop="onRowAction"
                @pointerdown.stop="onActionPointerDown"
              >
                <UndoLeftRoundIcon v-if="settled" class="size-icon" />
                <CheckIcon v-else class="size-icon" />
              </button>
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
} from "@components/ui/context-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import SessionStateIcon from "@features/session-nav/components/SessionStateIcon.vue"
import { sessionGlyph } from "@features/session-nav/lib/status-cycle.js"
import { Badge } from "@components/ui/badge/index.js"
import {
  formatRelativeTime,
  projectMonogram,
  workspaceName,
} from "@features/session-nav/lib/format.js"
import { formatElapsed } from "@utils/time.js"
import type { DropVerb } from "@features/session-nav/lib/drag-plan.js"
import type { SidebarSession, SidebarSessionState } from "@features/session-nav/type.js"
import {
  CheckCircleIcon,
  CheckIcon,
  CircleDashedIcon,
  CloseIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  RestartIcon,
  TrashBinMinimalisticIcon,
  UndoLeftRoundIcon,
} from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    session: SidebarSession
    active?: boolean
    pinned?: boolean
    settled?: boolean
    state?: SidebarSessionState | undefined
    variant?: "card" | "slim"
    /** 在跑会话的起始时刻：传了就把状态位换成工作中秒表。 */
    startedAt?: number | undefined

    placeholder?: boolean
    /** 拖起的浮层：实底加投影，行尾换成落点动作。 */
    dragging?: boolean
    draggable?: boolean
    /** 浮层落点上的动作。 */
    dropVerb?: DropVerb | null
    /** 被按住行尾动作扫过，松手时一起处理。 */
    swept?: boolean
  }>(),
  {
    state: undefined,
    variant: "card",
    startedAt: undefined,
    placeholder: false,
    dragging: false,
    draggable: false,
    dropVerb: null,
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
  dragStart: [event: PointerEvent]
  sweepStart: [event: PointerEvent]
}>()
const { t } = useI18n()
const menuOpen = ref(false)
const deleteOpen = shallowRef(false)
const projectName = computed(() => (props.session.cwd ? workspaceName(props.session.cwd) : ""))
const glyphState = computed(() => sessionGlyph(props.session, props.state))
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

// 只有工作中行需要秒表；别的行不起定时器。
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

  if (props.draggable && !renaming.value) emit("dragStart", event)
}

function onActionPointerDown(event: PointerEvent) {
  if (event.button === 0 && !props.placeholder) emit("sweepStart", event)
}

const verbIcons = { pin: PinIcon, unpin: CloseIcon, settle: CheckIcon, unsettle: UndoLeftRoundIcon }
const verb = computed(() => {
  const value = props.dragging ? props.dropVerb : null
  return value ? { icon: verbIcons[value], label: t(`session.${value}`) } : null
})

function onCardClick(event: MouseEvent) {
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

/** 行尾动作：未归档的归档，已归档的还原。 */
function onRowAction() {
  if (props.settled) emit("unsettle", props.session.id)
  else emit("settle", props.session.id)
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

/* 落点动作：拖起时替代右端的状态与时间 */
.drop-verb {
  position: absolute;
  inset-inline-end: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  height: 20px;
  padding-inline: var(--space-xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--info-bg);
  color: var(--primary);
  font-size: var(--text-meta);
  font-weight: var(--font-weight-medium);
  line-height: 1;
  white-space: nowrap;
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

.session-item:hover .session-card {
  background: var(--btn-hover);
}

.session-card[data-state="open"],
.session-card.active {
  background: var(--btn-selected);
}

.project-icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  color: var(--contrast-foreground-faint);
}

/* t3code 式项目缩写：soft 徽标收成 16px 方块 */
.project-mono[data-accent-color] {
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: calc(var(--radius-control) / 2);
  font-size: var(--text-monogram);
  font-weight: var(--font-weight-bold);
  line-height: 1;
  letter-spacing: 0;
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
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
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
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--duration-fast) var(--ease-hover);
}

/* 悬停、当前会话、菜单打开时回到一级文本色 */
.session-item:hover .title,
.session-card[data-state="open"] .title,
.session-card.active .title {
  color: var(--contrast-foreground);
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
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
}

/* 工作中：虚线圆环 + 状态名 + 已跑秒数，用强调色压过右边的弱化信息 */
.working-status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: var(--space-xxs);
  color: var(--info);
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

.session-item:hover .state-mark,
.session-item:focus-within .state-mark,
.session-item.is-menu-open .state-mark {
  opacity: 0;
}

.row-action {
  position: absolute;
  inset-inline-end: calc(var(--space-xs) * -1);
  top: 50%;
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding-block: var(--icon-button-pad);
  padding-inline: var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  white-space: nowrap;
  translate: 0 -50%;
  opacity: 0;
  pointer-events: none;
  transition:
    opacity var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-hover);
}

.session-card.slim .row-action {
  padding-inline: var(--icon-button-pad);
}

.session-item:hover .row-action,
.session-item:focus-within .row-action,
.row-action:focus-visible,
.session-item.is-menu-open .row-action {
  opacity: 1;
  pointer-events: auto;
}

/* 文字动作对齐 t3code：只在悬停时提亮，不铺底 */
.row-action:hover,
.row-action:focus-visible {
  color: var(--contrast-foreground);
}

/* 放在悬停规则之后：浮层与扫过态压过悬停与聚焦 */
/* 拖起的浮层：实底加投影，不缩放 */
.session-item.is-dragging .session-card {
  background: var(--popover);
  color: var(--contrast-foreground);
  box-shadow: var(--shadow-popover);
  cursor: grabbing;
}

.session-item.is-dragging .title {
  color: var(--contrast-foreground);
}

/* 被扫过的行：铺选中底，行尾动作常亮 */
.session-item.is-swept .session-card {
  background: var(--btn-selected);
}

.session-item.is-swept .state-mark {
  opacity: 0;
}

.session-item.is-swept .row-action {
  color: var(--contrast-foreground);
  opacity: 1;
}

.session-item.is-dragging .state-mark,
.session-item.is-dragging .row-action {
  opacity: 0;
  pointer-events: none;
}

.rename-input {
  min-width: 0;
  flex: 1;
  height: 21px;
  margin-block: -2px;
  padding: 0 var(--space-xxs);
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  outline: none;
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  box-shadow: inset 0 0 0 1px var(--primary);
}

:global(.title-tooltip) {
  max-width: 320px !important;
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
