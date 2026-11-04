<template>
  <header class="workbench-header">
    <Tooltip>
      <TooltipTrigger as-child>
        <IconButton
          class="header-toggle"
          :class="{ 'is-stowed': sidebarExpanded }"
          type="button"
          size="m"
          variant="ghost"
          :inert="sidebarExpanded"
          :aria-label="t('nav.openSidebar')"
          @click="emit('toggleSidebar')"
        >
          <PanelRightOpenIcon />
        </IconButton>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
    </Tooltip>

    <Tooltip v-if="cwdLabel">
      <TooltipTrigger as-child>
        <Badge class="header-cwd" variant="soft" color="gray">{{ cwdLabel }}</Badge>
      </TooltipTrigger>

      <TooltipContent>{{ cwdPath }}</TooltipContent>
    </Tooltip>

    <template v-if="title">
      <span ref="sizer" class="header-title header-sizer" aria-hidden="true">{{ sizerText }}</span>

      <input
        ref="titleInput"
        v-model="draft"
        class="header-title"
        :style="{ width: titleWidth }"
        :aria-label="t('session.rename')"
        spellcheck="false"
        @focus="onFocus"
        @keydown.enter.prevent="commit"
        @keydown.escape.prevent="cancel"
        @blur="commit"
      />

      <DropdownMenu v-if="sessionId" :modal="false">
        <DropdownMenuTrigger as-child>
          <IconButton
            class="header-more"
            type="button"
            size="m"
            variant="ghost"
            :aria-label="t('common.more')"
          >
            <MenuDotsIcon class="size-icon" />
          </IconButton>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" class="select-none">
          <DropdownMenuItem @select="emit('togglePinned')">
            <PinBoldIcon v-if="pinned" />
            <PinIcon v-else />
            {{ pinned ? t("session.unpin") : t("session.pin") }}
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
    </template>

    <SessionItemDelete v-model:open="deleteOpen" :title="title" @confirm="confirmDelete" />
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import { Badge } from "@components/ui/badge/index.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import { IconButton } from "@components/ui/button/index.js"
import {
  MenuDotsIcon,
  PanelRightOpenIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

const props = defineProps<{
  title: string
  /** 当前会话 id：实时会话缺失时回落到高亮会话。 */
  sessionId: string | undefined
  pinned: boolean
  cwdLabel: string
  cwdPath: string | undefined
  sidebarExpanded: boolean
}>()
const emit = defineEmits<{
  toggleSidebar: []
  rename: [name: string]
  togglePinned: []
  delete: []
}>()
const { t } = useI18n()
const titleInput = useTemplateRef("titleInput")
const draft = ref("")
const dirty = shallowRef(false)
const deleteOpen = shallowRef(false)
const sizer = useTemplateRef("sizer")
const sizerWidth = ref(0)
const sizerText = computed(() =>
  draft.value || props.title ? `${draft.value || props.title} ` : "",
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
  () => props.title,
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
  draft.value = props.title
  dirty.value = false
  titleInput.value?.blur()
}

function commit(): void {
  const name = draft.value.trim()

  dirty.value = false

  if (props.sessionId && name && name !== props.title) emit("rename", name)
  else draft.value = props.title
  titleInput.value?.blur()
}

function focusTitle(): void {
  titleInput.value?.focus()
}

function confirmDelete(): void {
  deleteOpen.value = false
  emit("delete")
}
</script>

<style scoped>
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
  /* 与下方正文同底色：头部不另起一层 */
  background: transparent;
  color: var(--toolbar-foreground);
}

.header-toggle {
  overflow: hidden;
  /* 与侧栏同档 200ms；opacity 稍快进出，让形状先到位 */
  transition:
    width var(--duration-normal) var(--ease-smooth),
    margin var(--duration-normal) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-out);
}

/* 侧栏展开时收起入口：宽度归零并抵消 gap，图标同步形变 */
.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--space-xs));
  opacity: 0;
  pointer-events: none;
}

/* 目录名长度收口交给 Badge；这里只管不换行与截断 */
.header-cwd {
  max-width: 12em;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
}

.header-title {
  flex: none;
  /* 宽度由 sizer 量的文本宽度接管，不保底宽 */
  min-width: 0;
  max-width: min(30em, 100%);
  height: var(--size-nav-rail);
  margin: 0;
  padding: 0 var(--space-xs);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-normal);
  line-height: var(--text-caption--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  outline: none;
}

.header-title:hover {
  background: var(--hover-quiet);
}

.header-title:focus {
  background: var(--interaction-hover);
  color: var(--contrast-foreground);
  caret-color: var(--primary);
  box-shadow: inset 0 0 0 1px var(--primary);
  user-select: text;
}

.header-sizer {
  position: absolute;
  visibility: hidden;
  width: auto;
  height: auto;
  padding-inline-end: var(--space-sm);
  pointer-events: none;
  white-space: pre;
}

/* 尺寸与悬停由 IconButton 接管；这里是它与标题之间的负偏移 */
.header-more {
  margin-inline-start: calc(var(--space-xxs) - var(--space-xs));
}

.header-more[data-state="open"] {
  background: var(--hover-quiet);
}

/* 拖窗：macOS 的浮层标题条与 Windows 的隐藏标题条都靠头部这一行 */
html:is([data-pig-desktop-platform="darwin"], [data-pig-desktop-platform="win32"])
  .workbench-header,
html:is([data-pig-desktop-platform="darwin"], [data-pig-desktop-platform="win32"]) .header-title {
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
      [data-slot="badge"]
    )
  ) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

/* Windows 的系统窗控浮在右上角，头部让出这一块（宽度由 Electron 的 env 给出） */
html[data-pig-desktop-platform="win32"] .workbench-header {
  padding-inline-end: calc(100vw - env(titlebar-area-width, 100vw) + var(--space-sm));
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
