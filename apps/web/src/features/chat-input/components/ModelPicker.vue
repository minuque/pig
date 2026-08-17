<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="selector" :disabled="disabled" :aria-label="`模型：${label}`">
        <span class="selector-name">{{ label }}</span>
        <ChevronDown :size="12" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="start"
      :side-offset="6"
      aria-label="选择模型"
      class="z-30 w-[280px] rounded-(--radius-lg) shadow-(--shadow-popover) data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]"
      @open-auto-focus="onOpenAutoFocus"
      @pointer-down-outside="suppressFocusRestore"
      @close-auto-focus="onCloseAutoFocus"
    >
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
          <template v-for="item in list" :key="keyOf(item)">
            <div v-if="item.data.type === 'label'" class="group-label">
              {{ item.data.vendor.name }}
            </div>
            <DropdownMenuItem
              v-else
              class="model-item gap-[7px] rounded-[7px] px-2 py-0 h-[28px] text-[11px] font-medium active:scale-100 cursor-pointer hover:bg-canvas-soft focus:bg-canvas-soft data-[current]:text-primary"
              :data-current="isCurrent(item.data.vendor.id, item.data.model.id) ? '' : undefined"
              @select="select({ provider: item.data.vendor.id, id: item.data.model.id })"
            >
              <VendorMark :name="item.data.vendor.name" :size="14" />
              <span class="model-body">
                <span class="model-name">{{ item.data.model.name }}</span>
              </span>
              <span v-if="item.data.model.thinkingLevels.length === 1" class="model-tag">默认</span>
              <Check
                v-if="isCurrent(item.data.vendor.id, item.data.model.id)"
                :size="13"
                class="model-check"
              />
            </DropdownMenuItem>
          </template>
        </div>
        <div v-else class="empty">没有匹配的模型</div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Check, ChevronDown, Search } from "lucide-vue-next";
import { useVirtualList } from "@vueuse/core";
import { computed, ref, watch } from "vue";
import type { ModelRef } from "@earendil-works/pi-protocol";
import {
  modelLabel,
  sameModel,
  type ChatInputModelInfo,
  type ChatInputVendor,
} from "@features/chat-input/types.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";
import VendorMark from "@features/chat-input/components/VendorMark.vue";
import { filterCatalog, resolveModelInfo } from "@features/chat-input/model-preset.js";

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
const searchRef = ref<HTMLInputElement | null>(null);

const current = computed(() => resolveModelInfo(props.catalog, props.model));

const filtered = computed(() => filterCatalog(props.catalog, query.value));

type FlatItem =
  | { type: "label"; vendor: ChatInputVendor }
  | { type: "model"; vendor: ChatInputVendor; model: ChatInputModelInfo };

// 供应商分组扁平化为行，供虚拟滚动按固定高度渲染
const items = computed<FlatItem[]>(() => {
  const out: FlatItem[] = [];
  for (const vendor of filtered.value) {
    out.push({ type: "label", vendor });
    for (const model of vendor.models) out.push({ type: "model", vendor, model });
  }
  return out;
});

const LABEL_HEIGHT = 24;
const ITEM_HEIGHT = 28;

const { list, containerProps, wrapperProps } = useVirtualList(items, {
  itemHeight: (index) => (items.value[index]?.type === "label" ? LABEL_HEIGHT : ITEM_HEIGHT),
});

function keyOf(item: { data: FlatItem }): string {
  const d = item.data;
  return d.type === "label" ? `label:${d.vendor.id}` : `model:${d.vendor.id}/${d.model.id}`;
}

// 每次打开清空上次搜索
watch(open, (isOpen) => {
  if (isOpen) query.value = "";
});

// 选择器标签：品牌名 + 模型名，均来自 catalog 数据
const label = computed(() => {
  const { vendor, model } = current.value;
  if (!vendor || !model) return modelLabel(props.model);
  return `${vendor.name} · ${model.name}`;
});

function isCurrent(provider: string, id: string) {
  return sameModel(props.model, { provider, id });
}
function select(model: ModelRef) {
  emit("update:model", model);
  // 菜单由 reka-ui 在 select 后自动关闭
}

// 打开后聚焦搜索框（阻止 reka 默认聚焦内容容器）
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  searchRef.value?.focus();
}

// 外点关闭时禁止 reka 把焦点抢回触发器，让点击落在目标元素上
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
.search {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  height: 26px;
  margin-bottom: 4px;
  border-radius: 7px;
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
  font-size: 11px;
}
.search input::placeholder {
  color: var(--ink-faint);
}
.groups {
  max-height: 300px;
  overflow-y: auto;
}
.group-label {
  display: flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.model-body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.model-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.model-tag {
  flex: none;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--canvas-soft);
  color: var(--ink-muted);
  font-size: 9px;
  font-weight: 500;
}
.model-check {
  flex: none;
  color: var(--primary);
}
.empty {
  padding: 10px 8px;
  font-size: 11px;
  color: var(--ink-faint);
  text-align: center;
}
</style>
