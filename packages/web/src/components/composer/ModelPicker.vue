<template>
  <DropdownMenu v-model:open="open" :modal="false">
    <DropdownMenuTrigger as-child>
      <button type="button" class="selector" :disabled="disabled" :aria-label="`模型：${label}`">
        <VendorMark :name="current.vendor?.name ?? ''" :size="12" />
        <span class="selector-name">{{ label }}</span>
        <ChevronDown :size="12" class="selector-chevron" />
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
      <div class="groups">
        <template v-if="filtered.length">
          <div v-for="vendor in filtered" :key="vendor.id" class="group">
            <div class="group-label">{{ vendor.name }}</div>
            <DropdownMenuItem
              v-for="m in vendor.models"
              :key="m.id"
              class="model-item gap-[7px] rounded-[7px] px-2 py-[5px] text-[11px] font-medium active:scale-100 cursor-pointer hover:bg-canvas-soft focus:bg-canvas-soft data-[current]:text-primary"
              :data-current="`${vendor.id}/${m.id}` === model ? '' : undefined"
              @select="select(`${vendor.id}/${m.id}`)"
            >
              <VendorMark :name="vendor.name" :size="14" />
              <span class="model-body">
                <span class="model-name">{{ m.name }}</span>
                <span v-if="m.description" class="model-desc">{{ m.description }}</span>
              </span>
              <span v-if="m.thinkingLevels.length === 1" class="model-tag">默认</span>
              <Check v-if="`${vendor.id}/${m.id}` === model" :size="13" class="model-check" />
            </DropdownMenuItem>
          </div>
        </template>
        <div v-else class="empty">没有匹配的模型</div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { Check, ChevronDown, Search } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import type { ModelVendor } from "@pig/contracts";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu/index.js";
import VendorMark from "./VendorMark.vue";
import { filterCatalog, parseModelId } from "./model-preset.js";

const props = withDefaults(
  defineProps<{
    catalog: ModelVendor[];
    model: string; // "provider/id"
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  "update:model": [value: string];
}>();

const open = ref(false);
const query = ref("");
const searchRef = ref<HTMLInputElement | null>(null);

const current = computed(() => {
  const { vendorId, modelId: id } = parseModelId(props.model);
  const vendor = props.catalog.find((v) => v.id === vendorId);
  return { vendor, model: vendor?.models.find((m) => m.id === id) };
});

const filtered = computed(() => filterCatalog(props.catalog, query.value));

// 每次打开清空上次搜索
watch(open, (isOpen) => {
  if (isOpen) query.value = "";
});

// 选择器标签：品牌名 + 模型名，均来自 catalog 数据
const label = computed(() => {
  const { vendor, model } = current.value;
  if (!vendor || !model) return props.model;
  return `${vendor.name} · ${model.name}`;
});

function select(model: string) {
  emit("update:model", model);
  // 菜单由 reka-ui 在 select 后自动关闭
}

// 打开后聚焦搜索框（阻止 reka 默认聚焦内容容器）
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  searchRef.value?.focus();
}

// 外点关闭时禁止 reka 把焦点抢回触发器，让点击落在目标元素上（与旧行为一致）
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
.selector {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  max-width: 160px;
  padding: 0 7px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.selector:hover:not(:disabled) {
  background: var(--canvas-soft);
}
.selector:disabled {
  opacity: 0.5;
  cursor: default;
}
.selector-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selector-chevron {
  flex: none;
  opacity: 0.55;
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
  padding: 4px 8px 3px;
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
.model-desc {
  font-size: 10px;
  font-weight: 400;
  color: var(--ink-muted);
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
