<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="settings-dialog" :show-close-button="false" @interact-outside.prevent>
      <DialogTitle class="sr-only">{{ t("settings.title") }}</DialogTitle>

      <div class="settings-shell" @keydown="onShellKeydown">
        <nav class="settings-nav" :aria-label="t('settings.title')">
          <div class="settings-search">
            <MagnifierIcon class="size-icon search-icon" />

            <input
              ref="searchInput"
              v-model="query"
              class="search-input"
              type="text"
              :placeholder="t('settings.search')"
              :aria-label="t('settings.search')"
              @input="activeResult = 0"
              @keydown="onSearchKeydown"
            />

            <button
              v-if="searching"
              type="button"
              class="search-clear"
              :aria-label="t('settings.clearSearch')"
              @click="clearSearch(true)"
            >
              <CloseIcon class="size-icon" />
            </button>

            <Kbd v-else class="search-kbd" size="s">/</Kbd>
          </div>

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

            <DialogClose class="settings-close" :aria-label="t('common.close')">
              <CloseIcon class="size-icon" />
            </DialogClose>
          </header>

          <div ref="scroller" class="settings-scroll">
            <div class="settings-body">
              <GeneralPane v-if="active === 'general'" />
              <NotificationsPane v-else-if="active === 'notifications'" />
              <ModelsPane v-else :refresh-models="refreshModels" />
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, provide, ref, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@components/ui/dialog/index.js"
import {
  BellIcon,
  CloseIcon,
  CloudIcon,
  MagnifierIcon,
  Tuning2OutlineIcon,
} from "@components/icons/index.js"
import { Kbd } from "@components/ui/kbd/index.js"
import GeneralPane from "./GeneralPane.vue"
import ModelsPane from "./models/ModelsPane.vue"
import NotificationsPane from "./NotificationsPane.vue"
import { matchSettings, type SettingsSearchEntry } from "@features/settings/lib/settings-search.js"

import type {
  SettingsCrumb,
  SettingsPane as Pane,
} from "@features/settings/hooks/use-settings-dialog.js"
import { SETTINGS_TRAIL } from "@features/settings/hooks/use-settings-dialog.js"

const props = defineProps<{
  open: boolean
  /** 打开时定位的分区，默认 General。 */
  initialPane?: Pane | undefined
  /** 刷新模型后同步 Composer 的模型目录。 */
  refreshModels?: (() => Promise<void>) | undefined
}>()
const emit = defineEmits<{ "update:open": [open: boolean] }>()
const { t } = useI18n()
const active = ref<Pane>(props.initialPane ?? "general")
const scroller = ref<HTMLElement>()
const trail = ref<SettingsCrumb[]>([])

provide(SETTINGS_TRAIL, trail)

const tabs = computed<{ id: Pane; label: string; icon: typeof Tuning2OutlineIcon }[]>(() => [
  {
    id: "general",
    label: t("settings.general"),
    icon: Tuning2OutlineIcon,
  },
  { id: "models", label: t("settings.models.title"), icon: CloudIcon },
  { id: "notifications", label: t("settings.notifications"), icon: BellIcon },
])
/** 头部路径：设置 + 分区自己的下钻层级，没有下钻就落到当前分区名。 */
const crumbs = computed<SettingsCrumb[]>(() => {
  const base: SettingsCrumb[] = [{ label: t("settings.title") }]
  const items = trail.value.length
    ? trail.value
    : [{ label: tabs.value.find((item) => item.id === active.value)?.label ?? "" }]
  return [...base, ...items]
})
const query = ref("")
const activeResult = ref(0)
const searchInput = ref<HTMLInputElement>()
/** 可搜的设置项：标题配所属分组，命中后按 id 滚动。 */
const searchEntries = computed<SettingsSearchEntry[]>(() => [
  {
    id: "setting-appearance",
    pane: "general",
    title: t("settings.appearance"),
    section: t("settings.general"),
  },
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
    id: "setting-font-size",
    pane: "general",
    title: t("settings.fontSize"),
    section: t("settings.interface"),
  },
  {
    id: "setting-chat-width",
    pane: "general",
    title: t("settings.chatWidth"),
    section: t("settings.interface"),
  },
  {
    id: "setting-translucent",
    pane: "general",
    title: t("settings.translucentWindow"),
    section: t("settings.interface"),
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

/** 打开结果：切分区、收起搜索结果，再滚到目标并闪一下。 */
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

/** 弹框里按 / 直接搜，输入框里不拦。 */
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

/** 每次打开回到 initialPane（默认 General），切分区回到顶部。 */
watch(
  () => props.open,
  async (open) => {
    if (!open) return

    active.value = props.initialPane ?? "general"
    await nextTick()
    resetScroll()
  },
)

/** 弹框已开时再次 openSettings 也要切到新分区。 */
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
/* 内容经 Portal 挂到 body，scoped 打不中，选择器统一挂在 .settings-dialog 前缀下。 */
.settings-dialog {
  display: flex;
  width: min(88vw, var(--size-settings-dialog-width));
  max-width: min(88vw, var(--size-settings-dialog-width));
  height: clamp(var(--size-settings-dialog-height-min), 85vh, var(--size-settings-dialog-height));
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
  gap: var(--space-xxs);
  width: var(--size-settings-dialog-nav);
  padding: var(--space-sm) var(--space-xs);
  border-inline-end: var(--border-width) solid var(--border-soft);
  background: var(--background);
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
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--text-body--line-height);
  text-align: start;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .nav-item:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .nav-item.on {
  background: var(--sidebar-selected);
  color: var(--contrast-foreground);
}

.settings-dialog .settings-search {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: 2rem;
  padding-inline: var(--space-xs);
  border-radius: var(--radius-control);
  color: var(--contrast-foreground-faint);
  font-size: var(--text-body);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .settings-search:focus-within {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .search-icon {
  flex: none;
}

.settings-dialog .search-input {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--contrast-foreground);
  font: inherit;
  outline: none;
}

.settings-dialog .search-input::placeholder {
  color: var(--contrast-foreground-faint);
}

.settings-dialog .search-clear {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border: 0;
  border-radius: calc(var(--radius-control) / 2);
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.settings-dialog .search-clear:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .settings-search-empty {
  margin: 0;
  padding: var(--space-lg) var(--space-xs);
  color: var(--contrast-foreground-faint);
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
  background: var(--sidebar-selected);
}

.settings-dialog .result-title {
  overflow: hidden;
  color: var(--contrast-foreground);
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-dialog .result-section {
  overflow: hidden;
  color: var(--contrast-foreground-faint);
  font-size: var(--text-meta);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 搜索结果命中的行：滚过去后闪一圈，再自己褪掉 */
.settings-dialog .is-settings-flash {
  border-radius: var(--radius-card);
  animation: settings-flash 1.4s var(--ease-out);
}

@keyframes settings-flash {
  from {
    box-shadow: 0 0 0 2px var(--primary);
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
  background: var(--card);
}

.settings-dialog .settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  gap: var(--space-xs);
  height: 3rem;
  padding-inline: calc(var(--space-md) + var(--space-xxs)) var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-soft);
}

.settings-dialog .settings-crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--contrast-foreground-faint);
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
  color: var(--contrast-foreground);
}

.settings-dialog .crumb[aria-current="page"] {
  color: var(--contrast-foreground);
}

.settings-dialog .crumb-sep {
  color: var(--contrast-foreground-faint);
  user-select: none;
}

.settings-dialog .settings-close {
  display: grid;
  flex: none;
  place-items: center;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  border-radius: var(--radius-control);
  color: var(--contrast-foreground-faint);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.settings-dialog .settings-close:hover {
  background: var(--hover-quiet);
  color: var(--contrast-foreground);
}

.settings-dialog .settings-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-lg) var(--space-lg) calc(var(--space-xxl) + var(--space-md));
}

.settings-dialog .settings-body {
  width: 100%;
  max-width: var(--size-settings-body);
  margin-inline: auto;
}

@media (max-width: 720px) {
  .settings-dialog .settings-search {
    display: none;
  }

  .settings-dialog .settings-nav {
    align-items: center;
    width: var(--size-settings-dialog-nav-narrow);
    padding-inline: var(--space-xxs);
  }

  .settings-dialog .nav-label {
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
