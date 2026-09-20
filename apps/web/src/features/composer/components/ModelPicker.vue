<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        static
        class="selector"
        :disabled="disabled"
        :aria-label="`选择模型，当前：${triggerText}`"
        :title="triggerText"
      >
        <VendorMark
          v-if="current.vendor"
          :vendor="current.vendor.id"
          :name="current.vendor.name"
          :size="14"
        />

        <span class="selector-name">{{ label }}</span>
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="end"
      :side-offset="6"
      :collision-padding="16"
      class="w-[min(var(--size-drawer),calc(100vw-var(--spacing-lg)))] max-h-[min(320px,var(--reka-dropdown-menu-content-available-height))] overflow-hidden overflow-y-hidden p-0 rounded-(--radius-lg) shadow-(--shadow-popover)"
      @open-auto-focus.prevent="nextTick(focusSearch)"
      @pointer-down-outside="onPointerDownOutside"
      @focus-outside="onFocusOutside"
      @close-auto-focus="onCloseAutoFocus"
    >
      <div ref="pickerRef" class="picker" @keydown.capture="onPanelKeydown">
        <div class="rail">
          <Button
            type="button"
            class="rail-btn"
            title="收藏模型"
            :data-current="scope === FAVORITES_SCOPE ? '' : undefined"
            @click="selectScope(FAVORITES_SCOPE)"
          >
            <Star class="size-icon" :fill="scope === FAVORITES_SCOPE ? 'currentColor' : 'none'" />
          </Button>

          <Button
            v-for="vendor in catalog"
            :key="vendor.id"
            type="button"
            class="rail-btn"
            :title="vendor.name"
            :data-current="scope === vendor.id ? '' : undefined"
            @click="selectScope(vendor.id)"
          >
            <VendorMark :vendor="vendor.id" :name="vendor.name" :size="15" />
          </Button>
        </div>

        <div class="main">
          <div class="search">
            <Search :size="13" class="text-ink-faint shrink-0" />

            <input
              ref="searchRef"
              v-model="query"
              type="text"
              placeholder="搜索模型"
              aria-label="搜索模型"
              @keydown="onSearchKeydown"
            />
          </div>

          <div v-bind="containerProps" class="groups">
            <DropdownMenuGroup v-if="items.length" v-bind="wrapperProps">
              <div
                v-for="item in list"
                :key="`${item.data.vendor.id}/${item.data.model.id}`"
                class="model-row"
                :data-current="isCurrent(item.data.vendor.id, item.data.model.id) ? '' : undefined"
              >
                <DropdownMenuItem
                  class="model-item gap-(--spacing-xs) rounded-(--radius-md) px-(--spacing-xs) py-0 h-(--size-control) text-button font-medium active:scale-100 cursor-pointer hover:bg-transparent focus:bg-transparent"
                  @select="onSelectModel($event, item.data.vendor.id, item.data.model.id)"
                >
                  <VendorMark
                    :vendor="item.data.vendor.id"
                    :name="item.data.vendor.name"
                    :size="15"
                  />

                  <span class="model-body">
                    <span class="model-name">{{ item.data.model.name }}</span>
                    <span v-if="showVendor" class="model-vendor">{{ item.data.vendor.name }}</span>
                  </span>
                </DropdownMenuItem>

                <ModelEffortMenu
                  v-if="showEffort(item.data)"
                  :levels="item.data.model.thinkingLevels"
                  :level="level"
                  @update:level="emit('update:level', $event)"
                />

                <Button
                  type="button"
                  class="fav"
                  :aria-label="`${isFavorite(item.data.vendor.id, item.data.model.id) ? '取消收藏' : '收藏'} ${item.data.model.name}`"
                  :aria-pressed="isFavorite(item.data.vendor.id, item.data.model.id)"
                  :class="{ on: isFavorite(item.data.vendor.id, item.data.model.id) }"
                  @pointerdown.stop
                  @click.stop="toggleFavorite(item.data.vendor.id, item.data.model.id)"
                >
                  <Star
                    :size="14"
                    :fill="
                      isFavorite(item.data.vendor.id, item.data.model.id) ? 'currentColor' : 'none'
                    "
                  />
                </Button>
              </div>
            </DropdownMenuGroup>

            <div v-else class="empty">{{ emptyText }}</div>
          </div>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Search, Star } from "@lucide/vue"
import { useVirtualList } from "@vueuse/core"
import { computed, nextTick, watch } from "vue"
import type { ComposerModel, ComposerVendor } from "@features/composer/type.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button } from "@components/ui/button/index.js"
import ModelEffortMenu from "@features/composer/components/ModelEffortMenu.vue"
import VendorMark from "@features/composer/components/VendorMark.vue"
import { useModelFavorites } from "@features/composer/hooks/use-model-favorites.js"
import { useModelPickerPanel } from "@features/composer/hooks/use-model-picker-panel.js"
import {
  FAVORITES_SCOPE,
  listPickerRows,
  modelLabel,
  resolveModelInfo,
  sameModel,
  type ModelPickerRow,
} from "@features/composer/lib/model-preset.js"
import { pickerTriggerText } from "@features/composer/lib/thinking-level.js"

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
const EMPTY_FAVORITES = new Set<string>()
const { set: favoriteSet, isFavorite, toggle: toggleFavorite } = useModelFavorites()
const current = computed(() => resolveModelInfo(props.catalog, props.model))
const {
  query,
  scope,
  searchRef,
  pickerRef,
  selectScope,
  exitSearchTo,
  onPanelKeydown,
  onSearchKeydown,
  onPointerDownOutside,
  onFocusOutside,
  onCloseAutoFocus,
  focusSearch,
} = useModelPickerPanel(
  open,
  () => current.value.vendor?.id,
  () => props.catalog[0]?.id,
)
const showVendor = computed(() => Boolean(query.value.trim()) || scope.value === FAVORITES_SCOPE)
const items = computed(() =>
  listPickerRows(
    props.catalog,
    query.value,
    scope.value,
    scope.value === FAVORITES_SCOPE ? favoriteSet.value : EMPTY_FAVORITES,
  ),
)
const ROW_HEIGHT = 40
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(items, {
  itemHeight: ROW_HEIGHT,
})
const emptyText = computed(() =>
  query.value.trim() || scope.value !== FAVORITES_SCOPE ? "没有匹配的模型" : "还没有收藏的模型",
)
const label = computed(() => {
  const { vendor, model } = current.value
  return vendor && model ? model.name : modelLabel(props.model)
})
const triggerText = computed(() =>
  pickerTriggerText(label.value, props.level, current.value.levels),
)

watch([query, scope], async () => {
  await nextTick()
  scrollTo(0)
})

function isCurrent(provider: string, id: string) {
  return sameModel(props.model, { provider, id })
}

function showEffort(row: ModelPickerRow) {
  return isCurrent(row.vendor.id, row.model.id) && row.model.thinkingLevels.length > 1
}

function onSelectModel(event: Event, provider: string, id: string) {
  event.preventDefault()
  emit("update:model", { provider, id })

  if (!query.value.trim()) return
  exitSearchTo(provider)
}
</script>

<style scoped>
.selector {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xxs);
  min-width: 0;
  min-height: var(--size-icon-button);
  height: auto;
  flex-shrink: 1;
  padding: var(--spacing-xxs) var(--spacing-xs);
  border: 0;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--ink-faint);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    color var(--duration-fast) var(--ease-smooth);
}

.selector:hover:not(:disabled) {
  background: var(--hover-tint);
  color: var(--ink);
}

.selector:disabled {
  opacity: 0.5;
  cursor: default;
}

.selector:focus-visible,
.rail-btn:focus-visible,
.fav:focus-visible {
  outline: var(--border-width) solid var(--primary);
  outline-offset: -2px;
}

.selector[data-state="open"] {
  background: var(--hover-tint);
  color: var(--ink);
}

.selector-name,
.model-name,
.model-vendor {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-name {
  max-width: 14rem;
}

.picker {
  display: grid;
  grid-template-columns: var(--titlebar-inset) 1fr;
  height: min(320px, var(--reka-dropdown-menu-content-available-height, 70vh));
}

.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xxs);
  min-height: 0;
  padding: var(--spacing-xxs);
  overflow-y: auto;
  border-inline-end: var(--border-width) solid var(--border);
  scrollbar-width: none;
}

.rail-btn {
  display: grid;
  place-items: center;
  flex: none;
  width: var(--size-icon-button);
  height: var(--size-icon-button);
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}

.rail-btn:hover {
  background: var(--hover-tint);
  color: var(--ink);
}

.rail-btn[data-current] {
  background: var(--hover-strong);
  color: var(--ink);
}

.main {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-xxs);
  min-width: 0;
  min-height: 0;
}

.search {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  height: 32px;
  margin-bottom: var(--spacing-xxs);
  padding: 0 var(--spacing-xs);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
}

.search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--text-eyebrow);
}

.search input::placeholder {
  color: var(--ink-faint);
}

.groups {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.rail::-webkit-scrollbar,
.groups::-webkit-scrollbar {
  display: none;
}

.model-row {
  display: flex;
  align-items: center;
  height: var(--size-control);
  padding-inline-end: var(--spacing-xs);
  border-radius: var(--radius-md);
}

.model-row:hover,
.model-row:focus-within {
  background: var(--canvas-soft);
}

.model-row[data-current] {
  background: var(--hover-tint);
}

.model-item,
.model-body {
  flex: 1 1 auto;
  min-width: 0;
}

.model-body {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: var(--spacing-xxs);
}

.model-name {
  color: var(--ink);
  font-size: var(--text-button);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-button--line-height);
}

.model-vendor {
  min-width: 0;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
}

.fav {
  display: grid;
  place-items: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
}

.fav:hover {
  color: var(--ink-muted);
}

.fav.on {
  color: var(--primary);
}

.empty {
  padding: var(--spacing-lg) var(--spacing-xs);
  font-size: var(--text-eyebrow);
  color: var(--ink-faint);
  text-align: center;
}
</style>
