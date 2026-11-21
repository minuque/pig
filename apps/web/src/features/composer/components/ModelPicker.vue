<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <Tooltip :disabled="!labelsOverflow">
      <TooltipTrigger as-child>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            color="neutral"
            class="selector"
            :disabled="disabled"
            :aria-label="t('composer.selectModel', { model: triggerText })"
            @pointerenter="measureLabels"
          >
            <VendorMark
              v-if="current.vendor"
              :vendor="current.vendor.id"
              :name="current.vendor.name"
              :size="14"
            />

            <span ref="labelsRef" class="selector-labels">
              <span class="selector-name">{{ label }}</span>
              <RollText v-if="effortLabel" class="selector-effort" :text="effortLabel" />
            </span>

            <slot />
          </Button>
        </DropdownMenuTrigger>
      </TooltipTrigger>

      <TooltipContent>{{ triggerText }}</TooltipContent>
    </Tooltip>

    <DropdownMenuContent
      bare
      side="top"
      align="end"
      :side-offset="6"
      :collision-padding="16"
      class="picker-menu"
      @open-auto-focus.prevent="nextTick(focusSearch)"
      @pointer-down-outside="onPointerDownOutside"
      @focus-outside="onFocusOutside"
      @close-auto-focus="onCloseAutoFocus"
    >
      <div class="picker" @keydown.capture="onPickerKeydown">
        <div class="tabs-bar">
          <div class="tabs">
            <Tooltip>
              <TooltipTrigger as-child>
                <IconButton
                  type="button"
                  class="tab-btn"
                  size="m"
                  variant="ghost"
                  :aria-label="t('composer.favoriteModels')"
                  :data-current="scope === FAVORITES_SCOPE ? '' : undefined"
                  @click="selectScope(FAVORITES_SCOPE)"
                >
                  <StarFilledIcon class="size-icon-lg" v-if="scope === FAVORITES_SCOPE" />
                  <StarIcon class="size-icon-lg" v-else />
                </IconButton>
              </TooltipTrigger>

              <TooltipContent>{{ t("composer.favoriteModels") }}</TooltipContent>
            </Tooltip>

            <Tooltip v-for="vendor in catalog" :key="vendor.id">
              <TooltipTrigger as-child>
                <IconButton
                  type="button"
                  class="tab-btn"
                  size="m"
                  variant="ghost"
                  :aria-label="vendor.name"
                  :data-current="scope === vendor.id ? '' : undefined"
                  @click="selectScope(vendor.id)"
                >
                  <VendorMark :vendor="vendor.id" :name="vendor.name" :size="16" />
                </IconButton>
              </TooltipTrigger>

              <TooltipContent>{{ vendor.name }}</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip v-if="current.levels.length">
            <TooltipTrigger as-child>
              <IconButton
                type="button"
                size="m"
                variant="ghost"
                class="effort-reset"
                :aria-label="t('composer.restoreDefaultEffort')"
                :disabled="effortIsDefault"
                @click="resetEffort"
              >
                <RotateCcwIcon aria-hidden="true" />
              </IconButton>
            </TooltipTrigger>

            <TooltipContent>{{ t("composer.restoreDefault") }}</TooltipContent>
          </Tooltip>
        </div>

        <div class="search">
          <SearchIcon class="search-icon" />

          <input
            ref="searchRef"
            v-model="query"
            type="text"
            :placeholder="searchPlaceholder"
            :aria-label="searchPlaceholder"
            @keydown="onSearchKeydown"
          />
        </div>

        <div v-bind="containerProps" class="groups">
          <DropdownMenuGroup v-if="items.length" v-bind="wrapperProps">
            <ModelPickerRow
              v-for="item in list"
              :key="`${item.data.vendor.id}/${item.data.model.id}`"
              :vendor-id="item.data.vendor.id"
              :vendor-name="item.data.vendor.name"
              :model-name="item.data.model.name"
              :current="isCurrent(item.data.vendor.id, item.data.model.id)"
              :favorite="isFavorite(item.data.vendor.id, item.data.model.id)"
              @select="onSelectModel($event, item.data.vendor.id, item.data.model.id)"
              @toggle-favorite="toggleFavorite(item.data.vendor.id, item.data.model.id)"
            />
          </DropdownMenuGroup>

          <div v-else-if="!catalog.length" class="empty empty-setup">
            {{ t("composer.noModelsConfigured") }}

            <Button type="button" size="s" variant="ghost" color="accent" @click="configureModels">
              {{ t("composer.configureModels") }}
            </Button>
          </div>

          <div v-else class="empty">{{ emptyText }}</div>
        </div>

        <ModelEffortFooter
          v-if="current.levels.length"
          :levels="current.levels"
          :level="level"
          @update:level="emit('update:level', $event)"
        />
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { useVirtualList } from "@vueuse/core"
import { computed, nextTick, shallowRef, useTemplateRef, watch } from "vue"
import { useI18n } from "@i18n/index.js"
import type { ComposerModel, ComposerVendor } from "@features/composer/type.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button, IconButton } from "@components/ui/button/index.js"
import { RollText } from "@components/ui/roll-text/index.js"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip/index.js"
import ModelEffortFooter from "@features/composer/components/ModelEffortFooter.vue"
import ModelPickerRow from "@features/composer/components/ModelPickerRow.vue"
import VendorMark from "@components/icons/VendorMark.vue"
import { useModelFavorites } from "@features/composer/hooks/use-model-favorites.js"
import { useModelPickerPanel } from "@features/composer/hooks/use-model-picker-panel.js"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import {
  FAVORITES_SCOPE,
  listPickerRows,
  resolveModelInfo,
} from "@features/composer/lib/model-preset.js"
import { sameModel } from "@features/session/lib/model-ref.js"
import {
  displayThinkingLevel,
  formatThinkingLevel,
  pickerTriggerText,
} from "@features/composer/lib/thinking-level.js"
import { SearchIcon, RotateCcwIcon, StarFilledIcon, StarIcon } from "@components/icons/index.js"

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    model: ComposerModel | undefined
    level?: string
    disabled?: boolean
  }>(),
  { disabled: false, level: "" },
)
const emit = defineEmits<{
  "update:model": [value: ComposerModel]
  "update:level": [value: string]
}>()
const open = defineModel<boolean>("open", { default: false })
const searchRef = useTemplateRef<HTMLInputElement>("searchRef")
const labelsRef = useTemplateRef<HTMLElement>("labelsRef")
const labelsOverflow = shallowRef(false)

function measureLabels() {
  const el = labelsRef.value
  labelsOverflow.value = el ? el.scrollWidth > el.clientWidth + 1 : false
}

const EMPTY_FAVORITES = new Set<string>()
const { set: favoriteSet, isFavorite, toggle: toggleFavorite } = useModelFavorites()
const { t } = useI18n()
const { openSettings } = useSettingsDialog()
const current = computed(() => resolveModelInfo(props.catalog, props.model))
const {
  query,
  scope,
  selectScope,
  onPanelKeydown,
  onSearchKeydown: searchKeydown,
  onPointerDownOutside,
  onFocusOutside,
  onCloseAutoFocus,
  focusSearch,
} = useModelPickerPanel(
  open,
  () => current.value.vendor?.id,
  () => props.catalog[0]?.id,
  searchRef,
)
const items = computed(() =>
  listPickerRows(
    props.catalog,
    query.value,
    scope.value,
    scope.value === FAVORITES_SCOPE ? favoriteSet.value : EMPTY_FAVORITES,
  ),
)
const ROW_HEIGHT = 28
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(items, {
  itemHeight: ROW_HEIGHT,
})
const emptyText = computed(() =>
  query.value.trim() || scope.value !== FAVORITES_SCOPE
    ? t("composer.noMatchingModel")
    : t("composer.noFavorites"),
)
const searchPlaceholder = computed(() =>
  scope.value === FAVORITES_SCOPE ? t("composer.searchFavorites") : t("composer.searchModels"),
)
const label = computed(() => current.value.model?.name ?? props.model?.id ?? "—")
const effortLabel = computed(() =>
  formatThinkingLevel(displayThinkingLevel(props.level, current.value.levels)),
)
const effortIsDefault = computed(
  () => displayThinkingLevel(props.level, current.value.levels) === current.value.levels[0],
)

function resetEffort() {
  const first = current.value.levels[0]

  if (first !== undefined) emit("update:level", first)
}

const triggerText = computed(() =>
  pickerTriggerText(label.value, props.level, current.value.levels),
)
const scopeOrder = computed(() => [FAVORITES_SCOPE, ...props.catalog.map((vendor) => vendor.id)])

function cycleScope(event: KeyboardEvent) {
  event.stopPropagation()
  const order = scopeOrder.value
  const index = order.indexOf(scope.value)
  const next = order[(index + (event.shiftKey ? -1 : 1) + order.length) % order.length]

  if (next) selectScope(next)
}

watch([query, scope], async () => {
  await nextTick()
  scrollTo(0)
})

function isCurrent(provider: string, id: string) {
  return sameModel(props.model, { provider, id })
}

function configureModels() {
  open.value = false
  openSettings("models")
}

function onPickerKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
    const n = Number(event.key)

    if (n >= 1 && n <= 9) {
      event.preventDefault()
      const row = list.value[n - 1]

      if (row) {
        emit("update:model", { provider: row.data.vendor.id, id: row.data.model.id })
        open.value = false
      }

      return
    }
  }

  onPanelKeydown(event)
}

function onSearchKeydown(event: KeyboardEvent) {
  if (event.isComposing) return

  if (event.key === "Tab") {
    event.preventDefault()
    cycleScope(event)
    return
  }

  if (event.key === "Enter") {
    event.preventDefault()
    const first = items.value[0]

    if (first) {
      emit("update:model", { provider: first.vendor.id, id: first.model.id })
      open.value = false
    }

    return
  }

  searchKeydown(event)
}

function onSelectModel(event: Event, provider: string, id: string) {
  event.preventDefault()
  emit("update:model", { provider, id })

  if (!query.value.trim()) return
  selectScope(provider)
}
</script>

<style scoped>
.selector[data-button] {
  min-width: 0;
  flex-shrink: 1;
  margin: 0;
  gap: var(--space-xs);
  color: var(--fg);
  font-size: var(--text-body);
}

.selector[data-button]:not(:disabled):hover,
.selector[data-button][data-state="open"] {
  background-color: var(--bg-selected);
}

.selector-labels {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2xs);
  min-width: 0;
}

.selector-name {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-effort {
  flex: none;
  color: var(--fg-secondary);
}

:global(.picker-menu) {
  inline-size: min(320px, calc(100vw - var(--space-lg)));
  min-inline-size: min(320px, calc(100vw - var(--space-lg)));
  max-inline-size: min(320px, calc(100vw - var(--space-lg)));
  overflow: hidden;
}

.picker {
  display: flex;
  flex-direction: column;
  max-height: var(--reka-dropdown-menu-content-available-height, 70vh);
}

.tabs-bar {
  display: flex;
  flex: none;
  align-items: center;
  padding: 6px;
  border-bottom: var(--border-width) solid var(--border-subtle);
}

.tabs {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-bar:has(.effort-reset) .tabs {
  padding-inline-end: var(--space-lg);
  mask-image: linear-gradient(to left, transparent, black var(--space-lg));
}

.effort-reset {
  position: relative;
  flex: none;
}

.tab-btn {
  position: relative;
  color: var(--fg-secondary);
  cursor: pointer;
}

.tab-btn::after {
  content: "";
  position: absolute;
  inset-inline: 6px;
  bottom: -6px;
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--accent-solid);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.tab-btn[data-current] {
  color: var(--fg);
}

.tab-btn[data-current]::after {
  opacity: 1;
}

.search {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  min-height: var(--control-md);
  padding-inline: 10px;
  border-bottom: var(--border-width) solid var(--border-subtle);
}

.search-icon {
  flex: none;
  color: var(--fg-muted);
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-meta);
}

.search input::placeholder {
  color: var(--fg-muted);
}

.groups {
  flex: 0 1 auto;
  min-height: 80px;
  max-height: min(200px, 40vh);
  padding: var(--space-2xs);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.empty {
  padding: var(--space-md) var(--space-xs);
  font-size: var(--text-meta);
  color: var(--fg-secondary);
  text-align: center;
}

.empty-setup {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
}
</style>
