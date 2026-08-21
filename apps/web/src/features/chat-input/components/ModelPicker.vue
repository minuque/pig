<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="selector" :disabled="disabled" :aria-label="`模型：${label}`">
        <VendorMark
          v-if="current.vendor"
          :vendor="current.vendor.id"
          :name="current.vendor.name"
          :size="14"
        />
        <span class="selector-name">{{ label }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="start"
      :side-offset="6"
      aria-label="选择模型"
      class="z-30 w-[min(400px,calc(100vw-24px))] max-h-[min(320px,var(--reka-dropdown-menu-content-available-height))] overflow-hidden p-0 rounded-(--radius-lg) shadow-(--shadow-popover) data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]"
      @open-auto-focus="onOpenAutoFocus"
      @pointer-down-outside="suppressFocusRestore"
      @close-auto-focus="onCloseAutoFocus"
    >
      <div class="picker">
        <div class="rail" aria-label="按供应商筛选">
          <button
            type="button"
            class="rail-btn"
            title="收藏模型"
            aria-label="收藏模型"
            :aria-pressed="scope === FAVORITES_SCOPE"
            :data-current="scope === FAVORITES_SCOPE ? '' : undefined"
            @click="scope = FAVORITES_SCOPE"
          >
            <Star
              :size="16"
              :fill="scope === FAVORITES_SCOPE ? 'currentColor' : 'none'"
              aria-hidden="true"
            />
          </button>
          <button
            v-for="vendor in catalog"
            :key="vendor.id"
            type="button"
            class="rail-btn"
            :title="vendor.name"
            :aria-label="vendor.name"
            :aria-pressed="scope === vendor.id"
            :data-current="scope === vendor.id ? '' : undefined"
            @click="scope = vendor.id"
          >
            <VendorMark :vendor="vendor.id" :name="vendor.name" :size="16" />
          </button>
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
            <div v-if="items.length" v-bind="wrapperProps">
              <div
                v-for="item in list"
                :key="`${item.data.vendor.id}/${item.data.model.id}`"
                class="model-row"
                :data-current="isCurrent(item.data.vendor.id, item.data.model.id) ? '' : undefined"
              >
                <DropdownMenuItem
                  class="model-item gap-2 rounded-(--radius-md) px-2.5 py-0 h-[52px] text-[13px] font-medium active:scale-100 cursor-pointer hover:bg-transparent focus:bg-transparent"
                  @select="select({ provider: item.data.vendor.id, id: item.data.model.id })"
                >
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
                <button
                  type="button"
                  class="fav"
                  tabindex="-1"
                  :class="{ on: isFavorite(item.data.vendor.id, item.data.model.id) }"
                  :aria-label="
                    isFavorite(item.data.vendor.id, item.data.model.id) ? '取消收藏' : '收藏模型'
                  "
                  @pointerdown.stop
                  @click.stop="toggleFavorite(item.data.vendor.id, item.data.model.id)"
                >
                  <Star
                    :size="14"
                    :fill="
                      isFavorite(item.data.vendor.id, item.data.model.id) ? 'currentColor' : 'none'
                    "
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
            <div v-else class="empty">{{ emptyText }}</div>
          </div>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ChevronDown, Search, Star } from "lucide-vue-next";
import { useVirtualList } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import type { ModelRef } from "@earendil-works/pi-protocol";
import { modelLabel, sameModel, type ChatInputVendor } from "@features/chat-input/types.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import VendorMark from "@features/chat-input/components/VendorMark.vue";
import { useModelFavorites } from "@features/chat-input/hooks/use-model-favorites.js";
import {
  FAVORITES_SCOPE,
  listPickerRows,
  resolveModelInfo,
} from "@features/chat-input/lib/model-preset.js";

const props = withDefaults(
  defineProps<{
    catalog: ChatInputVendor[];
    model: ModelRef | undefined;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  "update:model": [value: ModelRef];
}>();

const open = ref(false);
const query = ref("");
const scope = ref(FAVORITES_SCOPE);
const searchRef = ref<HTMLInputElement | null>(null);
const EMPTY_FAVORITES = new Set<string>();
const { set: favoriteSet, isFavorite, toggle: toggleFavorite } = useModelFavorites();

const current = computed(() => resolveModelInfo(props.catalog, props.model));

const items = computed(() =>
  listPickerRows(
    props.catalog,
    query.value,
    scope.value,
    scope.value === FAVORITES_SCOPE ? favoriteSet.value : EMPTY_FAVORITES,
  ),
);

const ITEM_HEIGHT = 52;
const { list, containerProps, wrapperProps } = useVirtualList(items, {
  itemHeight: ITEM_HEIGHT,
});

const emptyText = computed(() =>
  scope.value === FAVORITES_SCOPE && !query.value.trim() ? "还没有收藏的模型" : "没有匹配的模型",
);

watch(open, (isOpen) => {
  if (!isOpen) return;
  query.value = "";
  scope.value = current.value.vendor?.id ?? props.catalog[0]?.id ?? FAVORITES_SCOPE;
});

const label = computed(() => {
  const { vendor, model } = current.value;
  if (!vendor || !model) return modelLabel(props.model);
  return model.name;
});

function isCurrent(provider: string, id: string) {
  return sameModel(props.model, { provider, id });
}
function select(model: ModelRef) {
  emit("update:model", model);
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  searchRef.value?.focus();
}

let suppressRestore = false;
function suppressFocusRestore() {
  suppressRestore = true;
}
function onCloseAutoFocus(event: Event) {
  if (suppressRestore) event.preventDefault();
  suppressRestore = false;
}
</script>

<style scoped>
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
  padding: 6px 4px;
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
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink-muted);
  cursor: pointer;
}
.rail-btn:hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
}
.rail-btn[data-current] {
  background: color-mix(in srgb, var(--ink) 12%, transparent);
  color: var(--ink);
}
.main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  margin: 8px 8px 4px;
  padding: 0 8px;
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
  font-size: 12px;
}
.search input::placeholder {
  color: var(--ink-faint);
}
.groups {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 4px 6px;
}
.model-row {
  display: flex;
  align-items: center;
  height: 52px;
  padding-right: 4px;
  border-radius: var(--radius-md);
}
.model-row:hover,
.model-row:focus-within {
  background: var(--canvas-soft);
}
.model-row[data-current] {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
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
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}
.model-vendor {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  color: var(--ink-faint);
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
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
  padding: 24px 8px;
  font-size: 12px;
  color: var(--ink-faint);
  text-align: center;
}
</style>
