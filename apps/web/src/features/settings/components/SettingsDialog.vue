<template>
  <Dialog :open="open" :close-on-outside-press="false" @update:open="emit('update:open', $event)">
    <DialogContent
      class="settings-dialog"
      :show-close-button="false"
      initial-focus="content"
      @keydown="onShellKeydown"
    >
      <DialogTitle class="sr-only">{{ t("settings.title") }}</DialogTitle>

      <div class="settings-shell">
        <nav class="settings-nav" :aria-label="t('settings.title')">
          <TextFieldRoot
            ref="searchInput"
            v-model="query"
            size="m"
            variant="soft"
            color="neutral"
            class="settings-search"
            type="text"
            :placeholder="t('settings.search')"
            :aria-label="t('settings.search')"
            @update:model-value="activeResult = 0"
            @keydown="onSearchKeydown"
          >
            <TextFieldSlot side="left">
              <SearchIcon class="size-icon" />
            </TextFieldSlot>

            <TextFieldSlot side="right">
              <IconButton
                v-if="searching"
                type="button"
                size="s"
                variant="ghost"
                color="neutral"
                class="search-clear"
                :aria-label="t('settings.clearSearch')"
                @click="clearSearch(true)"
              >
                <XIcon class="size-icon-sm" />
              </IconButton>

              <Kbd v-else class="search-kbd" size="s">/</Kbd>
            </TextFieldSlot>
          </TextFieldRoot>

          <template v-if="searching">
            <p v-if="!results.length" class="settings-search-empty">
              {{ t("settings.searchEmpty") }}
            </p>

            <button
              v-for="(result, index) in results"
              :key="`${result.pane}-${result.title}`"
              type="button"
              class="search-result"
              :class="{ on: index === activeResult }"
              @mousemove="activeResult = index"
              @click="openResult(result)"
            >
              <span class="result-title">{{ result.title }}</span>
              <span class="result-section">{{ result.section }}</span>
            </button>
          </template>

          <template v-else>
            <button
              v-for="item in tabs"
              :key="item.id"
              class="nav-item"
              :class="{ on: active === item.id }"
              type="button"
              :aria-current="active === item.id ? 'page' : undefined"
              @click="select(item.id)"
            >
              <component :is="item.icon" class="size-icon" />
              <span class="nav-label">{{ item.label }}</span>
              <span v-if="item.count" class="nav-count">{{ item.count }}</span>
            </button>
          </template>
        </nav>

        <div class="settings-right">
          <header class="settings-head">
            <nav class="settings-crumbs" :aria-label="t('settings.title')">
              <template v-for="(crumb, index) in crumbs" :key="`${index}-${crumb.label}`">
                <span v-if="index > 0" class="crumb-sep" aria-hidden="true">/</span>

                <button v-if="crumb.action" type="button" class="crumb" @click="crumb.action()">
                  {{ crumb.label }}
                </button>

                <span
                  v-else
                  class="crumb"
                  :aria-current="index === crumbs.length - 1 ? 'page' : undefined"
                >
                  {{ crumb.label }}
                </span>
              </template>
            </nav>

            <DialogClose>
              <template #render="{ props: part }">
                <IconButton
                  v-bind="part"
                  type="button"
                  size="m"
                  variant="ghost"
                  color="neutral"
                  class="settings-close"
                  :aria-label="t('common.close')"
                >
                  <XIcon class="size-icon" />
                </IconButton>
              </template>
            </DialogClose>
          </header>

          <div
            ref="scroller"
            class="settings-scroll"
            :class="{ 'is-fixed-pane': active === 'archive' }"
          >
            <div class="settings-scroll-content">
              <div class="settings-body">
                <GeneralPane v-if="active === 'general'" />
                <AppearancePane v-else-if="active === 'appearance'" />
                <NotificationsPane v-else-if="active === 'notifications'" />
                <ArchivePane v-else-if="active === 'archive' && archive" :controller="archive" />
                <ModelsPane v-else :refresh-models="refreshModels" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, ref, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@pig/ui/dialog"
import {
  ArchiveIcon,
  BellIcon,
  XIcon,
  CloudIcon,
  SearchIcon,
  PaletteIcon,
  SlidersHorizontalIcon,
} from "@components/icons/index.js"
import { sessionArchives } from "@client/session-archives.js"
import { Kbd } from "@pig/ui/kbd"
import { IconButton } from "@pig/ui/button"
import { TextFieldRoot, TextFieldSlot } from "@pig/ui/text-field"
import AppearancePane from "./AppearancePane.vue"
import ArchivePane from "./ArchivePane.vue"
import GeneralPane from "./GeneralPane.vue"
import ModelsPane from "./models/ModelsPane.vue"
import NotificationsPane from "./NotificationsPane.vue"
import { countArchiveTabs, type ArchiveController } from "@features/settings/lib/archive-view.js"
import { matchSettings, type SettingsSearchEntry } from "@features/settings/lib/settings-search.js"

import type {
  SettingsCrumb,
  SettingsPane as Pane,
} from "@features/settings/hooks/use-settings-dialog.js"
import { SETTINGS_TRAIL } from "@features/settings/hooks/use-settings-dialog.js"

const props = defineProps<{
  open: boolean
  initialPane?: Pane | undefined
  refreshModels?: (() => Promise<void>) | undefined
  archive?: ArchiveController | undefined
}>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const active = ref<Pane>(props.initialPane ?? "general")
const scroller = useTemplateRef<HTMLElement>("scroller")
const trail = ref<SettingsCrumb[]>([])

provide(SETTINGS_TRAIL, trail)

const tabs = computed<
  { id: Pane; label: string; icon: typeof SlidersHorizontalIcon; count?: number | undefined }[]
>(() => [
  {
    id: "general",
    label: t("settings.general"),
    icon: SlidersHorizontalIcon,
  },
  { id: "appearance", label: t("settings.appearance"), icon: PaletteIcon },
  { id: "models", label: t("settings.models.title"), icon: CloudIcon },
  { id: "notifications", label: t("settings.notifications"), icon: BellIcon },
  ...(props.archive
    ? [
        {
          id: "archive" as const,
          label: t("settings.archive.title"),
          icon: ArchiveIcon,
          count:
            countArchiveTabs(props.archive.allSessions.value, sessionArchives.value).archived ||
            undefined,
        },
      ]
    : []),
])
const crumbs = computed<SettingsCrumb[]>(() => {
  const base: SettingsCrumb[] = [{ label: t("settings.title") }]
  const items = trail.value.length
    ? trail.value
    : [{ label: tabs.value.find((item) => item.id === active.value)?.label ?? "" }]
  return [...base, ...items]
})
const query = ref("")
const activeResult = ref(0)
const searchInput = useTemplateRef<{ focus: () => void }>("searchInput")
const searchEntries = computed<SettingsSearchEntry[]>(() => [
  {
    id: "setting-user-name",
    pane: "general",
    title: t("settings.userName"),
    section: t("settings.interface"),
  },
  {
    id: "setting-language",
    pane: "general",
    title: t("settings.language"),
    section: t("settings.interface"),
  },
  {
    id: "setting-theme",
    pane: "appearance",
    title: t("settings.theme"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-welcome-field",
    pane: "appearance",
    title: t("settings.welcomeField"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-ui-font",
    pane: "appearance",
    title: t("settings.uiFont"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-density",
    pane: "appearance",
    title: t("settings.density"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-code-font",
    pane: "appearance",
    title: t("settings.codeFont"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-code-size",
    pane: "appearance",
    title: t("settings.codeSize"),
    section: t("settings.appearance"),
  },
  {
    id: "setting-chat-width",
    pane: "appearance",
    title: t("settings.chatWidth"),
    section: t("settings.appearance"),
  },
  {
    id: "",
    pane: "models",
    title: t("settings.models.providers"),
    section: t("settings.models.title"),
  },
  {
    id: "setting-notify-system",
    pane: "notifications",
    title: t("settings.notifySystem"),
    section: t("settings.notifications"),
  },
  {
    id: "setting-notify-sound",
    pane: "notifications",
    title: t("settings.notifySound"),
    section: t("settings.notifications"),
  },
  ...(props.archive
    ? [
        {
          id: "setting-archive",
          pane: "archive" as const,
          title: t("settings.archive.title"),
          section: t("settings.archive.title"),
          keywords: t("settings.archive.searchKeywords"),
        },
      ]
    : []),
])
const results = computed(() => matchSettings(searchEntries.value, query.value))
const searching = computed(() => query.value.trim().length > 0)

watch(results, (list) => {
  if (activeResult.value < list.length) return
  activeResult.value = Math.max(0, list.length - 1)
})

function clearSearch(focus = false) {
  query.value = ""
  activeResult.value = 0

  if (focus) searchInput.value?.focus()
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return

  if (event.key === "Escape" && searching.value) {
    event.preventDefault()
    event.stopPropagation()
    clearSearch(true)
    return
  }

  const list = results.value

  if (!list.length) return

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault()
    const step = event.key === "ArrowDown" ? 1 : -1
    activeResult.value = (activeResult.value + step + list.length) % list.length
    return
  }

  if (event.key !== "Enter") return
  event.preventDefault()

  const item = list[activeResult.value]

  if (item) void openResult(item)
}

async function openResult(item: SettingsSearchEntry) {
  active.value = item.pane
  query.value = ""
  activeResult.value = 0
  await nextTick()
  const root = scroller.value

  if (!root) return

  const target = item.id ? root.querySelector<HTMLElement>(`#${item.id}`) : null

  if (!target) {
    root.scrollTo({ top: 0 })
    return
  }

  target.scrollIntoView({ block: "center" })
  target.classList.add("is-settings-flash")
  window.setTimeout(() => target.classList.remove("is-settings-flash"), 1400)
}

function onShellKeydown(event: KeyboardEvent) {
  if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
  const target = event.target

  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
  ) {
    return
  }

  event.preventDefault()
  searchInput.value?.focus()
}

function select(pane: Pane) {
  active.value = pane
}

function resetScroll() {
  scroller.value?.scrollTo({ top: 0 })
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return

    active.value = props.initialPane ?? "general"
    await nextTick()
    resetScroll()
  },
)

watch(
  () => props.initialPane,
  (pane) => {
    if (props.open && pane) active.value = pane
  },
)

watch(active, async () => {
  await nextTick()
  resetScroll()
})
</script>

<style>
.settings-dialog {
  display: flex;
  width: min(88vw, var(--dialog-width-lg));
  max-width: min(88vw, var(--dialog-width-lg));
  height: clamp(var(--dialog-height-lg-min), 85vh, var(--dialog-height-lg));
  padding: 0;
  gap: 0;
  border-radius: var(--radius-dialog);
  overflow: hidden;
}

.settings-dialog .settings-shell {
  display: flex;
  width: 100%;
  min-height: 0;
}

.settings-dialog .settings-nav {
  display: flex;
  flex: none;
  flex-direction: column;
  gap: var(--space-2xs);
  width: 15rem;
  padding: var(--space-sm) var(--space-xs);
  border-inline-end: var(--border-width) solid var(--border-subtle);
  background: var(--sidebar);
  user-select: none;
}

.settings-dialog .nav-item {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  width: 100%;
  height: 2rem;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--fg-secondary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  text-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .nav-count {
  margin-inline-start: auto;
  color: var(--fg-muted);
  font-size: var(--text-meta);
  font-variant-numeric: tabular-nums;
}

.settings-dialog .nav-item:hover {
  background: var(--bg-hover);
  color: var(--fg);
}

.settings-dialog .nav-item.on {
  background: var(--bg-selected);
  color: var(--fg);
}

.settings-dialog .search-clear {
  inline-size: 20px;
  block-size: 20px;
}

.settings-dialog .settings-search-empty {
  margin: 0;
  padding: var(--space-lg) var(--space-xs);
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
  text-align: center;
}

.settings-dialog .search-result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: var(--space-xs);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  text-align: start;
  cursor: default;
}

.settings-dialog .search-result.on {
  background: var(--bg-selected);
}

.settings-dialog .result-title {
  overflow: hidden;
  color: var(--fg);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-dialog .result-section {
  overflow: hidden;
  color: var(--fg-secondary);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-dialog .is-settings-flash {
  border-radius: var(--radius-card);
  animation: settings-flash 1.4s var(--ease-out);
}

@keyframes settings-flash {
  from {
    box-shadow: 0 0 0 2px var(--accent-solid);
  }

  to {
    box-shadow: 0 0 0 2px transparent;
  }
}

.settings-dialog .settings-right {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--bg);
}

.settings-dialog .settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: var(--space-xs);
  height: 3rem;
  padding-inline: calc(var(--space-md) + var(--space-2xs)) var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

.settings-dialog .settings-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--fg-secondary);
  font-size: var(--text-body);
}

.settings-dialog .crumb {
  overflow: hidden;
  color: inherit;
  font-size: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-dialog button.crumb:hover {
  color: var(--fg);
}

.settings-dialog .crumb[aria-current="page"] {
  color: var(--fg);
}

.settings-dialog .crumb-sep {
  color: var(--fg-muted);
  user-select: none;
}

.settings-dialog .settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.settings-dialog .settings-scroll.is-fixed-pane {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-dialog .settings-scroll-content {
  padding: var(--space-lg) var(--space-lg) calc(var(--space-2xl) + var(--space-md));
}

.settings-dialog .settings-scroll.is-fixed-pane .settings-scroll-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding-bottom: var(--space-md);
}

.settings-dialog .settings-body {
  width: 100%;
  max-width: 56rem;
  margin-inline: auto;
}

.settings-dialog .settings-scroll.is-fixed-pane .settings-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

@media (max-width: 720px) {
  .settings-dialog .settings-search {
    display: none;
  }

  .settings-dialog .settings-nav {
    align-items: center;
    width: 2.75rem;
    padding-inline: var(--space-2xs);
  }

  .settings-dialog .nav-label,
  .settings-dialog .nav-count {
    display: none;
  }

  .settings-dialog .nav-item {
    justify-content: center;
    padding-inline: 0;
  }
}

@media (max-width: 639px) {
  .settings-dialog {
    width: 100%;
    max-width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .settings-dialog .nav-item,
  .settings-dialog .settings-close {
    transition: none;
  }
}
</style>
