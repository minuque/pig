<template>
  <header class="workbench-header">
    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          class="header-toggle"
          :class="{ 'is-stowed': sbState === 'expanded' }"
          type="button"
          size="m"
          variant="ghost"
          :inert="sbState === 'expanded'"
          :aria-label="t('nav.openSidebar')"
          @click="setSbState('expanded')"
        >
          <PanelRightOpenIcon :size="16" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
    </Tooltip>

    <nav v-if="title" class="header-crumbs" :aria-label="t('session.breadcrumb')">
      <ol class="crumb-list">
        <li v-if="cwdLabel" class="crumb-project">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="crumb-project-label">
                <FolderIcon class="crumb-icon" :size="14" />
                <span class="crumb-text">{{ cwdLabel }}</span>
              </span>
            </TooltipTrigger>

            <TooltipContent>{{ sessionCwd }}</TooltipContent>
          </Tooltip>
        </li>

        <li v-if="cwdLabel" class="crumb-separator" aria-hidden="true">/</li>

        <li class="crumb-current">
          <span ref="sizer" class="crumb-title crumb-sizer" aria-hidden="true">
            {{ sizerText }}
          </span>

          <input
            ref="titleInput"
            v-model="draft"
            class="crumb-title crumb-input"
            :style="{ width: titleWidth }"
            :aria-label="t('session.rename')"
            spellcheck="false"
            @focus="onFocus"
            @keydown.enter.prevent="commit"
            @keydown.escape.prevent="cancel"
            @blur="commit"
          />

          <DropdownMenu v-if="currentId" :modal="false">
            <DropdownMenuTrigger as-child>
              <IconButton
                class="crumb-more"
                type="button"
                size="s"
                variant="ghost"
                :aria-label="t('common.more')"
              >
                <AltArrowDownIcon :size="14" />
              </IconButton>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="select-none">
              <DropdownMenuItem @select="onTogglePinned">
                <PinBoldIcon v-if="isPinned" />
                <PinIcon v-else />
                {{ isPinned ? t("session.unpin") : t("session.pin") }}
              </DropdownMenuItem>

              <DropdownMenuItem @select="focusTitle">
                <PenIcon />
                {{ t("session.rename") }}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem variant="destructive" @select="deleteOpen = true">
                <TrashBinMinimalisticIcon />
                {{ t("session.deleteTitle") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ol>
    </nav>

    <Tooltip v-if="rail && sessionId">
      <TooltipTrigger as-child>
        <IconButton
          class="files-toggle"
          type="button"
          size="m"
          color="gray"
          variant="ghost"
          :data-active="files.open.value || undefined"
          :aria-pressed="files.open.value"
          :aria-label="t('files.toggle')"
          @click="files.toggle"
        >
          <FoldersIcon :size="16" />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ t("files.toggle") }}</TooltipContent>
    </Tooltip>

    <RailToggle v-if="rail" />
    <SessionItemDelete v-model:open="deleteOpen" :title="title" @confirm="confirmDelete" />
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { useLeftPanelToggle } from "@components/layout/hooks/use-left-panel.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { IconButton } from "@components/ui/button/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import RailToggle from "@features/session-rail/components/RailToggle.vue"
import { useFilePane } from "@features/file-pane/index.js"
import { useNav } from "@features/session-nav/index.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import { sessionTitle, untitledSession, useSession } from "@features/session/index.js"
import {
  AltArrowDownIcon,
  FolderIcon,
  FoldersIcon,
  PanelRightOpenIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

/** rail：右侧显示摘要面板开关（开场页不显示）。 */
defineProps<{ rail?: boolean }>()

const { t } = useI18n()
const { sbState, setSbState } = useLeftPanelToggle()
const files = useFilePane()
const { sessionId, projection, sessionCwd } = useSession()
const {
  listedSessions,
  pinnedIds,
  highlightedSessionId,
  togglePinned,
  renameSession,
  deleteSession,
} = useNav()
/** 当前会话 id：实时会话缺失时回落到高亮会话。 */
const currentId = computed(() => sessionId.value ?? highlightedSessionId.value)
const isPinned = computed(() => (currentId.value ? pinnedIds.value.has(currentId.value) : false))
/** 顶栏标题：列表名优先（改名后随 listSessions 更新），否则 snapshot 名。 */
const title = computed(() => {
  if (!sessionId.value) return ""
  const meta = listedSessions.value.find((session) => session.id === sessionId.value)
  return meta ? sessionTitle(meta) : projection.value?.name?.trim() || untitledSession()
})
const cwdLabel = computed(() => (sessionCwd.value ? workspaceName(sessionCwd.value) : ""))
const titleInput = useTemplateRef("titleInput")
const draft = ref("")
const dirty = shallowRef(false)
const deleteOpen = shallowRef(false)
const sizer = useTemplateRef("sizer")
const sizerWidth = ref(0)
const sizerText = computed(() =>
  draft.value || title.value ? `${draft.value || title.value} ` : "",
)
const titleWidth = computed(() => (sizerWidth.value > 0 ? `${sizerWidth.value}px` : undefined))
const measureSizer = () => {
  sizerWidth.value = sizer.value?.getBoundingClientRect().width ?? 0
}
// 标题为空时 sizer 整块不渲染，挂载那一刻量不到；等它出现再挂观察器
let sizerObserver: ResizeObserver | undefined

watch(
  sizer,
  (el) => {
    sizerObserver?.disconnect()
    sizerObserver = undefined
    sizerWidth.value = el?.getBoundingClientRect().width ?? 0

    if (!el || typeof ResizeObserver === "undefined") return
    sizerObserver = new ResizeObserver(measureSizer)
    sizerObserver.observe(el)
  },
  { flush: "post" },
)

onBeforeUnmount(() => sizerObserver?.disconnect())

watch(
  title,
  (value) => {
    if (!dirty.value) draft.value = value
  },
  { immediate: true },
)

function onFocus(): void {
  dirty.value = true
  void nextTick(() => titleInput.value?.select())
}

function cancel(): void {
  draft.value = title.value
  dirty.value = false
  titleInput.value?.blur()
}

function commit(): void {
  const name = draft.value.trim()

  dirty.value = false

  if (currentId.value && name && name !== title.value) onRename(name)
  else draft.value = title.value
  titleInput.value?.blur()
}

function focusTitle(): void {
  titleInput.value?.focus()
}

function onRename(name: string): void {
  const id = currentId.value

  if (id) void renameSession(id, name)
}

function onTogglePinned(): void {
  const id = currentId.value

  if (id) void togglePinned(id)
}

function onDelete(): void {
  const id = currentId.value

  if (id) void deleteSession(id)
}

function confirmDelete(): void {
  deleteOpen.value = false
  onDelete()
}
</script>

<style scoped>
/* 与摘要面板开关同一选中态 */
.files-toggle[data-active] {
  color: var(--contrast-foreground);
  background: var(--btn-selected);
}

.workbench-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: var(--header-height);
  min-height: var(--header-height);
  padding: var(--space-xxs) var(--space-sm);
  /* Windows 的系统窗控浮在右上角，头部让出这一块 */
  padding-inline-end: calc(var(--space-sm) + var(--titlebar-controls-inset));
  /* 与下方正文同底色：头部不另起一层 */
  background: transparent;
  color: var(--contrast-foreground);
}

.header-toggle {
  overflow: hidden;
  /* 与侧栏同档 200ms；opacity 稍快进出，让形状先到位 */
  transition:
    width var(--duration-normal) var(--ease-out),
    margin var(--duration-normal) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

/* 侧栏展开时收起入口：宽度归零并抵消 gap，图标同步形变 */
.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--space-xs));
  opacity: 0;
  pointer-events: none;
}

/* 面包屑：目录名 + 分隔符 + 会话名，标题占剩余宽度并截断 */
.header-crumbs {
  flex: 1;
  min-width: 0;
}

.crumb-list {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.crumb-project {
  display: flex;
  align-items: center;
  flex-shrink: 1;
  min-width: 0;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
}

.crumb-project-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  max-width: 10em;
  min-width: 0;
}

.crumb-icon {
  flex: none;
}

.crumb-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crumb-separator {
  flex: none;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
}

.crumb-current {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-xxs);
  min-width: 0;
}

.crumb-title {
  height: var(--size-nav-rail);
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.crumb-sizer {
  position: absolute;
  visibility: hidden;
  width: auto;
  height: auto;
  padding-inline-end: var(--space-sm);
  pointer-events: none;
  white-space: pre;
}

.crumb-input {
  flex: 0 1 auto;
  max-width: min(30em, 100%);
  min-width: 0;
  border-radius: var(--radius-control);
  outline: none;
  user-select: text;
}

.crumb-input:focus {
  caret-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
}

/* 操作入口：悬停或聚焦标题时出现，与 t3code 的标题下拉箭头一致 */
.crumb-more {
  flex: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.crumb-current:hover .crumb-more,
.crumb-current:focus-within .crumb-more,
.crumb-more[data-state="open"] {
  opacity: 1;
}

/* 拖窗：macOS 的浮层标题条与 Windows 的隐藏标题条都靠头部这一行 */
html:is([data-pig-desktop-platform="darwin"], [data-pig-desktop-platform="win32"])
  .workbench-header {
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .workbench-header {
  user-select: none;
}

/* 可交互内容与带 tooltip 的徽标从拖拽区里摘出来 */
html[data-pig-desktop-platform]
  .workbench-header
  :deep(
    :is(
      button,
      a,
      input,
      select,
      textarea,
      [role="tab"],
      [role="button"],
      [role="link"],
      .crumb-project-label
    )
  ) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* macOS 侧栏收起后红绿灯落在头部左上角，头部让位 */
html[data-pig-desktop-platform="darwin"] .shell.sb-offcanvas .workbench-header {
  padding-inline-start: calc(var(--space-sm) + var(--size-mac-traffic-lights));
}

@media (max-width: 520px) {
  .workbench-header > .header-toggle:not(.is-stowed) {
    width: calc(var(--size-nav-rail) + var(--space-xs));
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-toggle {
    transition: none;
  }
}
</style>
