<template>
  <header
    class="workbench-header"
    :class="{ 'is-leftmost': leftmost, 'is-rightmost': rightmost, 'is-dimmed': dimmed }"
  >
    <Tooltip v-if="leftmost">
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            class="header-toggle"
            :class="{ 'is-stowed': sbState === 'expanded' }"
            type="button"
            size="m"
            variant="ghost"
            :inert="sbState === 'expanded'"
            :aria-label="t('nav.openSidebar')"
            @click="setSbState('expanded')"
          >
            <PanelLeftIcon class="size-icon-lg" />
          </IconButton>
        </template>
      </TooltipTrigger>

      <TooltipContent>{{ t("nav.openSidebar") }}</TooltipContent>
    </Tooltip>

    <nav v-if="title" class="header-crumbs" :aria-label="t('session.breadcrumb')">
      <ol class="crumb-list">
        <li v-if="cwdLabel" class="crumb-project">
          <Tooltip>
            <TooltipTrigger>
              <template #render="{ props: part }">
                <span v-bind="part" class="crumb-project-label">
                  <ProjectIcon class="crumb-icon" :path="sessionCwd" />
                  <span class="crumb-text">{{ cwdLabel }}</span>
                </span>
              </template>
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
            <DropdownMenuTrigger>
              <template #render="{ props: part }">
                <IconButton
                  v-bind="part"
                  class="crumb-more"
                  type="button"
                  size="s"
                  variant="ghost"
                  :aria-label="t('common.more')"
                >
                  <ChevronDownIcon />
                </IconButton>
              </template>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="select-none">
              <DropdownMenuItem @select="onTogglePinned">
                <PinOffIcon v-if="isPinned" />
                <PinIcon v-else />
                {{ isPinned ? t("session.unpin") : t("session.pin") }}
              </DropdownMenuItem>

              <DropdownMenuItem @select="focusTitle">
                <PenIcon />
                {{ t("session.rename") }}
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem color="danger" @select="deleteOpen = true">
                <TrashIcon />
                {{ t("session.deleteTitle") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      </ol>
    </nav>

    <RailToggle v-if="rail" />

    <Tooltip v-if="rail && sessionId">
      <TooltipTrigger>
        <template #render="{ props: part }">
          <IconButton
            v-bind="part"
            class="files-toggle"
            type="button"
            size="m"
            color="neutral"
            variant="ghost"
            :data-active="files.open.value || undefined"
            :aria-pressed="files.open.value"
            :aria-label="t('files.toggle')"
            @click="toggleFiles"
          >
            <FolderOpenIcon v-if="files.open.value" class="size-icon-lg" />
            <FolderIcon v-else class="size-icon-lg" />
          </IconButton>
        </template>
      </TooltipTrigger>

      <TooltipContent>{{ t("files.toggle") }}</TooltipContent>
    </Tooltip>

    <span v-if="split.split.value" class="split-actions">
      <Tooltip v-if="!split.fits.value">
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              type="button"
              size="m"
              color="neutral"
              variant="ghost"
              :aria-label="t('split.switchSide')"
              @click="split.focusSide(side === 'left' ? 'right' : 'left')"
            >
              <ArrowLeftRightIcon class="size-icon-lg" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ t("split.switchSide") }}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger>
          <template #render="{ props: part }">
            <IconButton
              v-bind="part"
              type="button"
              size="m"
              color="neutral"
              variant="ghost"
              :aria-label="t('split.close')"
              @click="split.closeSide(side)"
            >
              <XIcon class="size-icon-lg" />
            </IconButton>
          </template>
        </TooltipTrigger>

        <TooltipContent>{{ t("split.close") }}</TooltipContent>
      </Tooltip>
    </span>

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
} from "@pig/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { IconButton } from "@pig/ui/button"
import ProjectIcon from "@features/session-nav/components/ProjectIcon.vue"
import SessionItemDelete from "@features/session-nav/components/SessionItemDelete.vue"
import RailToggle from "@features/session-rail/components/RailToggle.vue"
import { useFilePane } from "@features/file-pane/index.js"
import { useNav } from "@features/session-nav/index.js"
import { workspaceName } from "@features/session-nav/lib/format.js"
import { sessionTitle, untitledSession, useSession } from "@features/session/index.js"
import { usePaneSide, usePanelHost, useSplitView } from "@features/split-view/index.js"
import {
  ArrowLeftRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  PanelLeftIcon,
  PenIcon,
  PinIcon,
  PinOffIcon,
  TrashIcon,
  XIcon,
} from "@components/icons/index.js"

defineProps<{ rail?: boolean }>()

const { t } = useI18n()
const side = usePaneSide()
const split = useSplitView()
const panels = usePanelHost()
const sideBySide = computed(() => split.split.value && split.fits.value)
const leftmost = computed(() => side === "left" || !sideBySide.value)
const rightmost = computed(() => side === "right" || !sideBySide.value)
const dimmed = computed(() => sideBySide.value && split.focused.value !== side)
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
const currentId = computed(() => sessionId.value ?? highlightedSessionId.value)
const isPinned = computed(() => (currentId.value ? pinnedIds.value.has(currentId.value) : false))
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

function toggleFiles(): void {
  if (panels?.hidden("files")) panels.raise("files")
  else files.toggle()
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
.files-toggle[data-active] {
  color: var(--fg);
  background: var(--bg-selected);
}

.workbench-header {
  position: relative;
  z-index: var(--z-sticky);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: var(--header-height);
  min-height: var(--header-height);
  padding: var(--space-2xs) var(--space-sm);
  background: transparent;
  color: var(--fg);
}

.split-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-inline-start: auto;
}

.workbench-header.is-rightmost {
  padding-inline-end: calc(var(--space-sm) + var(--titlebar-controls-inset));
}

.workbench-header.is-dimmed .crumb-title {
  color: var(--fg-secondary);
}

.workbench-header.is-overlay {
  position: absolute;
  inset: 0 0 auto;
}

.header-toggle {
  overflow: hidden;
  transition:
    width var(--duration-normal) var(--ease-out),
    margin var(--duration-normal) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}

.header-toggle.is-stowed {
  width: 0;
  margin-inline-end: calc(-1 * var(--space-xs));
  opacity: 0;
  pointer-events: none;
}

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
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
}

.crumb-project-label {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
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
  color: var(--fg-muted);
  font-size: var(--text-body);
}

.crumb-current {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
}

.crumb-title {
  height: var(--control-sm);
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  color: var(--fg);
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
  caret-color: var(--accent-solid);
  box-shadow: inset 0 0 0 1px var(--accent-solid);
}

.crumb-more {
  flex: none;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.crumb-current:hover .crumb-more,
.crumb-current:focus-within .crumb-more,
.crumb-more[data-open] {
  opacity: 1;
}

html[data-pig-desktop-platform] .workbench-header {
  -webkit-app-region: drag;
  app-region: drag;
  user-select: none;
}

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

html[data-pig-desktop-platform="darwin"] .shell.sb-offcanvas .workbench-header.is-leftmost {
  padding-inline-start: calc(var(--space-sm) + var(--traffic-lights-width));
}

@media (max-width: 520px) {
  .workbench-header > .header-toggle:not(.is-stowed) {
    width: calc(var(--control-sm) + var(--space-xs));
  }
}

@media (prefers-reduced-motion: reduce) {
  .header-toggle {
    transition: none;
  }
}
</style>
