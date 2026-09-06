<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        class="selector"
        :disabled="disabled"
        :aria-label="`选择模型，当前：${label}`"
        :title="label"
      >
        <VendorMark
          v-if="current.vendor"
          :vendor="current.vendor.id"
          :name="current.vendor.name"
          :size="14"
        />
        <span class="selector-name">{{ label }}</span>
        <ChevronDown aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="start"
      :side-offset="6"
      class="w-[min(400px,calc(100vw-24px))] max-h-[min(320px,var(--reka-dropdown-menu-content-available-height))] overflow-hidden overflow-y-hidden p-0 rounded-(--radius-lg) shadow-(--shadow-popover)"
      @open-auto-focus="onOpenAutoFocus"
      @pointer-down-outside="suppressFocusRestore"
      @close-auto-focus="onCloseAutoFocus"
    >
      <div class="picker">
        <div class="rail">
          <Button
            type="button"
            class="rail-btn"
            title="收藏模型"
            :data-current="scope === FAVORITES_SCOPE ? '' : undefined"
            @click="scope = FAVORITES_SCOPE"
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
            @click="scope = vendor.id"
          >
            <VendorMark :vendor="vendor.id" :name="vendor.name" :size="15" />
          </Button>
        </div>

        <div class="main">
          <div class="search">
            <Search :size="13" class="search-icon" />
            <input
              ref="searchRef"
              v-model="query"
              type="text"
              placeholder="搜索模型"
              aria-label="搜索模型"
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
                  class="model-item gap-(--spacing-xs) rounded-(--radius-md) px-2.5 py-0 h-[52px] text-button font-medium active:scale-100 cursor-pointer hover:bg-transparent focus:bg-transparent"
                  @select="select({ provider: item.data.vendor.id, id: item.data.model.id })"
                >
                  <Check
                    v-if="isCurrent(item.data.vendor.id, item.data.model.id)"
                    aria-label="当前模型"
                  />
                  <span class="model-body">
                    <span class="model-name">{{ item.data.model.name }}</span>
                    <span class="model-vendor">
                      <VendorMark
                        :vendor="item.data.vendor.id"
                        :name="item.data.vendor.name"
                        :size="12"
                      />
                      {{ item.data.vendor.name }}
                    </span>
                  </span>
                </DropdownMenuItem>
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
import { Check, ChevronDown, Search, Star } from "@lucide/vue"
import { useVirtualList } from "@vueuse/core"
import { computed, nextTick, ref, watch } from "vue"
import type { ChatInputModel, ChatInputVendor } from "@/types/chat-input-type.js"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js"
import { Button } from "@components/ui/button/index.js"
import VendorMark from "@features/chat-input/components/VendorMark.vue"
import { useModelFavorites } from "@features/chat-input/hooks/use-model-favorites.js"
import {
  FAVORITES_SCOPE,
  listPickerRows,
  modelLabel,
  resolveModelInfo,
  sameModel,
} from "@features/chat-input/lib/model-preset.js"

const props = withDefaults(
  defineProps<{
    catalog: ChatInputVendor[]
    model: ChatInputModel | undefined
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  "update:model": [value: ChatInputModel]
}>()

const open = defineModel<boolean>("open", { default: false })

const query = ref("")
const scope = ref(FAVORITES_SCOPE)
const searchRef = ref<HTMLInputElement | null>(null)
const EMPTY_FAVORITES = new Set<string>()
const { set: favoriteSet, isFavorite, toggle: toggleFavorite } = useModelFavorites()

const current = computed(() => resolveModelInfo(props.catalog, props.model))

const items = computed(() =>
  listPickerRows(
    props.catalog,
    query.value,
    scope.value,
    scope.value === FAVORITES_SCOPE ? favoriteSet.value : EMPTY_FAVORITES,
  ),
)

const ITEM_HEIGHT = 52
const { list, containerProps, wrapperProps, scrollTo } = useVirtualList(items, {
  itemHeight: ITEM_HEIGHT,
})

watch([query, scope], async () => {
  await nextTick()
  scrollTo(0)
})

const emptyText = computed(() =>
  scope.value === FAVORITES_SCOPE && !query.value.trim() ? "还没有收藏的模型" : "没有匹配的模型",
)

watch(open, (isOpen) => {
  if (!isOpen) return
  query.value = ""
  scope.value = current.value.vendor?.id ?? props.catalog[0]?.id ?? FAVORITES_SCOPE
})

const label = computed(() => {
  const { vendor, model } = current.value
  if (!vendor || !model) return modelLabel(props.model)
  return model.name
})

function isCurrent(provider: string, id: string) {
  return sameModel(props.model, { provider, id })
}

function select(model: ChatInputModel) {
  emit("update:model", model)
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault()
  searchRef.value?.focus()
}

let suppressRestore = false

function suppressFocusRestore() {
  suppressRestore = true
}

function onCloseAutoFocus(event: Event) {
  if (suppressRestore) event.preventDefault()
  suppressRestore = false
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
.selector-name {
  max-width: 14rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker {
  display: grid;
  grid-template-columns: 44px 1fr;
  height: min(320px, var(--reka-dropdown-menu-content-available-height, 70vh));
}

.rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 0;
  padding: 6px var(--spacing-xxs);
  overflow-y: auto;
  border-right: var(--border-width) solid var(--hairline);
  scrollbar-width: none;
}
.rail::-webkit-scrollbar {
  display: none;
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
  gap: 6px;
  height: 32px;
  padding: 0 var(--spacing-xs);
  margin-bottom: var(--spacing-xxs);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
}
.search-icon {
  flex: none;
  color: var(--ink-faint);
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
.groups::-webkit-scrollbar {
  display: none;
}

.model-row {
  display: flex;
  align-items: center;
  height: 52px;
  border-radius: var(--radius-md);
}
.model-row:hover,
.model-row:focus-within {
  background: var(--canvas-soft);
}
.model-row[data-current] {
  background: var(--hover-tint);
}
.model-item {
  flex: 1 1 auto;
  min-width: 0;
}
.model-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
  font-size: var(--text-button);
  font-weight: var(--font-weight-semibold);
  line-height: var(--text-button--line-height);
}
.model-vendor {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-regular);
  line-height: var(--text-eyebrow--line-height);
  text-overflow: ellipsis;
  white-space: nowrap;
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
  color: var(--accent-sunset);
}

.empty {
  padding: var(--spacing-lg) var(--spacing-xs);
  font-size: var(--text-eyebrow);
  color: var(--ink-faint);
  text-align: center;
}
</style>
