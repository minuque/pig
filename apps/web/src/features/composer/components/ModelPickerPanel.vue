<template>
  <PopoverContent
    side="top"
    align="end"
    :side-offset="6"
    :collision-padding="16"
    :initial-focus="() => searchRef"
    class="picker-menu"
  >
    <div class="picker" @keydown.capture="onPanelKeydown">
      <div class="tabs-bar">
        <ToggleGroup
          class="tabs"
          :aria-label="t('composer.modelScope')"
          :value="[scope]"
          :deselectable="false"
          @value-change="(next: string[]) => next[0] && selectScope(next[0])"
        >
          <Tooltip>
            <TooltipTrigger>
              <template #render="{ props: part }">
                <Toggle v-bind="part" :value="FAVORITES_SCOPE">
                  <template #render="{ props: toggle }">
                    <IconButton
                      v-bind="toggle"
                      type="button"
                      class="tab-btn"
                      size="m"
                      variant="ghost"
                      :aria-label="t('composer.favoriteModels')"
                    >
                      <StarFilledIcon v-if="scope === FAVORITES_SCOPE" class="size-icon-lg" />
                      <StarIcon v-else class="size-icon-lg" />
                    </IconButton>
                  </template>
                </Toggle>
              </template>
            </TooltipTrigger>

            <TooltipContent>{{ t("composer.favoriteModels") }}</TooltipContent>
          </Tooltip>

          <Tooltip v-for="vendor in catalog" :key="vendor.id">
            <TooltipTrigger>
              <template #render="{ props: part }">
                <Toggle v-bind="part" :value="vendor.id">
                  <template #render="{ props: toggle }">
                    <IconButton
                      v-bind="toggle"
                      type="button"
                      class="tab-btn"
                      size="m"
                      variant="ghost"
                      :aria-label="vendor.name"
                    >
                      <VendorMark :vendor="vendor.id" :name="vendor.name" :size="16" />
                    </IconButton>
                  </template>
                </Toggle>
              </template>
            </TooltipTrigger>

            <TooltipContent>{{ vendor.name }}</TooltipContent>
          </Tooltip>
        </ToggleGroup>

        <Tooltip v-if="current.levels.length">
          <TooltipTrigger>
            <template #render="{ props: part }">
              <IconButton
                v-bind="part"
                type="button"
                size="m"
                variant="ghost"
                class="effort-reset"
                :aria-label="t('composer.restoreDefaultEffort')"
                :disabled="effortIsDefault || locked"
                @click="resetEffort"
              >
                <RotateCcwIcon aria-hidden="true" />
              </IconButton>
            </template>
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

      <ModelPickerList
        :items="items"
        :catalog="catalog"
        :favorites="favoriteSet"
        :model="model"
        :empty-text="emptyText"
        :disabled="locked"
        @select="onSelectModel"
        @toggle-favorite="toggleFavorite"
        @configure="configureModels"
      />

      <ModelEffortFooter
        v-if="current.levels.length"
        :levels="current.levels"
        :level="level"
        :disabled="locked"
        @update:level="emit('update:level', $event)"
      />
    </div>
  </PopoverContent>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue"
import { useI18n } from "@i18n/index.js"
import { IconButton } from "@pig/ui/button"
import { PopoverContent } from "@pig/ui/popover"
import { Toggle, ToggleGroup } from "@pig/ui/toggle"
import { Tooltip, TooltipContent, TooltipTrigger } from "@pig/ui/tooltip"
import { RotateCcwIcon, SearchIcon, StarFilledIcon, StarIcon } from "@components/icons/index.js"
import VendorMark from "@components/icons/VendorMark.vue"
import ModelEffortFooter from "@features/composer/components/ModelEffortFooter.vue"
import ModelPickerList from "@features/composer/components/ModelPickerList.vue"
import { useModelFavorites } from "@features/composer/hooks/use-model-favorites.js"
import { useModelPickerPanel } from "@features/composer/hooks/use-model-picker-panel.js"
import { useSettingsDialog } from "@features/settings/hooks/use-settings-dialog.js"
import {
  FAVORITES_SCOPE,
  listPickerRows,
  resolveModelInfo,
} from "@features/composer/lib/model-preset.js"
import { displayThinkingLevel } from "@utils/thinking-level.js"
import type { ComposerModel, ComposerVendor } from "@features/composer/type.js"

const props = withDefaults(
  defineProps<{
    catalog: ComposerVendor[]
    model: ComposerModel | undefined
    level?: string
    locked?: boolean
  }>(),
  { level: "", locked: false },
)
const emit = defineEmits<{
  pick: [model: ComposerModel]
  "update:level": [value: string]
}>()
const open = defineModel<boolean>("open", { default: false })
const searchRef = useTemplateRef<HTMLInputElement>("searchRef")
const EMPTY_FAVORITES = new Set<string>()
const { set: favoriteSet, toggle: toggleFavorite } = useModelFavorites()
const { t } = useI18n()
const { openSettings } = useSettingsDialog()
const current = computed(() => resolveModelInfo(props.catalog, props.model))
const {
  query,
  scope,
  selectScope,
  cycleScope,
  onPanelKeydown,
  onSearchKeydown: searchKeydown,
} = useModelPickerPanel(
  open,
  () => current.value.vendor?.id,
  () => props.catalog[0]?.id,
  () => favoriteSet.value.size > 0,
  () => props.catalog.map((vendor) => vendor.id),
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
const emptyText = computed(() =>
  query.value.trim() || scope.value !== FAVORITES_SCOPE
    ? t("composer.noMatchingModel")
    : t("composer.noFavorites"),
)
const searchPlaceholder = computed(() =>
  scope.value === FAVORITES_SCOPE ? t("composer.searchFavorites") : t("composer.searchModels"),
)
const effortIsDefault = computed(
  () => displayThinkingLevel(props.level, current.value.levels) === current.value.levels[0],
)

function resetEffort() {
  const first = current.value.levels[0]

  if (first !== undefined) emit("update:level", first)
}

function pick(provider: string, id: string) {
  if (props.locked) return
  emit("pick", { provider, id })
  open.value = false
}

function configureModels() {
  open.value = false
  openSettings("models")
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

    if (first) pick(first.vendor.id, first.model.id)
    return
  }

  searchKeydown(event)
}

function onSelectModel(provider: string, id: string) {
  pick(provider, id)

  if (!query.value.trim()) return
  selectScope(provider)
}
</script>

<style scoped>
:global(.picker-menu) {
  inline-size: min(320px, calc(100vw - var(--space-lg)));
  min-inline-size: min(320px, calc(100vw - var(--space-lg)));
  max-inline-size: min(320px, calc(100vw - var(--space-lg)));
  padding: 0;
  overflow: hidden;
}

.picker {
  display: flex;
  flex-direction: column;
  max-height: var(--popup-available-height, 70vh);
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
  corner-shape: round;
  background: var(--accent-solid);
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-out);
}

.tab-btn[data-pressed] {
  color: var(--fg);
}

.tab-btn[data-pressed]::after {
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
</style>
