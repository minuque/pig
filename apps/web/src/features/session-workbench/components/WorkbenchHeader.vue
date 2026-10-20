<template>
  <header class="workbench-header">
    <Tooltip>
      <TooltipTrigger as-child>
        <button
          class="header-toggle"
          :class="{ 'is-stowed': sbState === 'expanded' }"
          type="button"
          :inert="sbState === 'expanded'"
          :aria-label="t('nav.openSidebar')"
          @click="setSbState('expanded')"
        >
          <SidebarGlyph :open="leftOpen" />
        </button>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
    </Tooltip>

    <Tooltip v-if="cwdLabel">
      <TooltipTrigger as-child>
        <span class="header-cwd">{{ cwdLabel }}</span>
      </TooltipTrigger>

      <TooltipContent>{{ sessionCwd }}</TooltipContent>
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

      <DropdownMenu v-if="currentId" :modal="false">
        <DropdownMenuTrigger as-child>
          <button class="header-more" type="button" :aria-label="t('common.more')">
            <MenuDotsIcon class="size-icon" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" class="select-none">
          <DropdownMenuItem @select="togglePinned(currentId)">
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
    </template>

    <SessionItemDelete v-model:open="deleteOpen" :title="title" @confirm="confirmDelete" />
  </header>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useTemplateRef,
  watch,
} from "vue"
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
import { useNav } from "@features/session-nav/index.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import { useSession } from "@features/session-workbench/index.js"
import { workbenchHeaderTitle } from "@features/session-workbench/lib/session-state.js"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import {
  MenuDotsIcon,
  PenIcon,
  PinIcon,
  PinBoldIcon,
  SidebarGlyph,
  TrashBinMinimalisticIcon,
} from "@components/icons/index.js"

const { t } = useI18n()
const { leftOpen, sbState, setSbState } = useLeftPanelToggle()
const { sessionId, projection, sessionCwd } = useSession()
const {
  listedSessions,
  pinnedIds,
  highlightedSessionId,
  togglePinned,
  renameSession,
  deleteSession,
} = useNav()
const titleInput = useTemplateRef<HTMLInputElement>("titleInput")
const currentId = computed(() => sessionId.value ?? highlightedSessionId.value)
const isPinned = computed(() => (currentId.value ? pinnedIds.value.has(currentId.value) : false))
const title = computed(() =>
  workbenchHeaderTitle({
    sessionId: sessionId.value,
    listed: listedSessions.value,
    projectionName: projection.value?.name,
  }),
)
const cwdLabel = computed(() => (sessionCwd.value ? workspaceName(sessionCwd.value) : ""))
const draft = ref("")
const dirty = shallowRef(false)
const deleteOpen = shallowRef(false)
const sizer = useTemplateRef<HTMLElement>("sizer")
const sizerWidth = ref(0)
const sizerText = computed(() =>
  draft.value || title.value ? `${draft.value || title.value} ` : "",
)
const titleWidth = computed(() => (sizerWidth.value > 0 ? `${sizerWidth.value}px` : undefined))
const measureSizer = () => {
  sizerWidth.value = sizer.value?.getBoundingClientRect().width ?? 0
}

onMounted(() => {
  measureSizer()

  if (!sizer.value || typeof ResizeObserver === "undefined") return
  const observer = new ResizeObserver(measureSizer)

  observer.observe(sizer.value)
  onBeforeUnmount(() => observer.disconnect())
})

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
  const id = currentId.value
  const name = draft.value.trim()

  dirty.value = false

  if (id && name && name !== title.value) void renameSession(id, name)
  else draft.value = title.value
  titleInput.value?.blur()
}

function focusTitle(): void {
  titleInput.value?.focus()
}

function confirmDelete(): void {
  deleteOpen.value = false

  if (currentId.value) void deleteSession(currentId.value)
}
</script>

<style scoped>
.workbench-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  width: 100%;
  min-height: calc(var(--size-nav-rail) + 2 * var(--spacing-sm));
  padding: var(--spacing-xs) var(--spacing-sm);
  border-bottom: var(--border-width) solid var(--border-subtle);
  background: var(--toolbar-background);
  color: var(--toolbar-foreground);
}

.header-toggle {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--size-nav-rail);
  height: var(--size-nav-rail);
  overflow: hidden;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
  /* 与侧栏同档 200ms；opacity 稍快进出，让形状先到位 */
  transition:
    width var(--duration-normal) var(--ease-smooth),
    margin var(--duration-normal) var(--ease-smooth),
    opacity var(--duration-fast) var(--ease-out);
}

/* 侧栏展开时收起入口：宽度归零并抵消 gap，图标同步形变 */
.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--spacing-xs));
  opacity: 0;
  pointer-events: none;
}

.header-toggle:hover,
.header-toggle:focus-visible {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.header-cwd {
  display: inline-flex;
  flex: none;
  align-items: center;
  max-width: 12em;
  padding: 2px var(--spacing-xs);
  overflow: hidden;
  border-radius: var(--radius-sm);
  background: var(--hover-tint);
  color: var(--contrast-foreground);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: default;
}

.header-title {
  flex: none;
  min-width: 4em;
  max-width: min(30em, 100%);
  height: var(--size-nav-rail);
  margin: 0;
  padding: 0 var(--spacing-xs);
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
  padding-inline-end: var(--spacing-sm);
  pointer-events: none;
  white-space: pre;
}

.header-more {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  margin-inline-start: calc(var(--spacing-xxs) - var(--spacing-xs));
  padding: var(--icon-button-pad);
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--contrast-foreground-muted);
}

.header-more:hover,
.header-more:focus-visible,
.header-more[data-state="open"] {
  color: var(--contrast-foreground);
}

html[data-pig-desktop-platform] .workbench-header,
html[data-pig-desktop-platform] .header-title {
  -webkit-app-region: drag;
  app-region: drag;
}

html[data-pig-desktop-platform] .workbench-header {
  /* 45 = 44 标题栏 + 1px 底边线：底边线不落在原生窗控按钮区域里，不会被按钮背景盖住 */
  height: calc(var(--titlebar-inset) + var(--border-width));
  min-height: calc(var(--titlebar-inset) + var(--border-width));
  user-select: none;
}

html[data-pig-desktop-platform]
  .workbench-header
  :deep(:is(button, a, input, select, textarea, [role="tab"], [role="button"], [role="link"])) {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

html[data-pig-desktop-platform="win32"] .workbench-header {
  padding-inline-end: calc(
    var(--spacing-sm) +
      max(
        var(--size-windows-caption),
        100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)
      )
  );
}

@media (max-width: 520px) {
  .workbench-header > .header-toggle:not(.is-stowed) {
    width: calc(var(--size-nav-rail) + var(--spacing-xs));
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-toggle {
    transition: none;
  }
}
</style>
