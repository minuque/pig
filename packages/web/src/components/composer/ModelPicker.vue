<script setup lang="ts">
import { Check, ChevronDown, Search } from "lucide-vue-next";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { ModelVendor } from "@no-pi-no-gang/contracts";

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
const root = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);

const current = computed(() => {
  const sep = props.model.indexOf("/");
  const provider = props.model.slice(0, sep);
  const id = props.model.slice(sep + 1);
  const vendor = props.catalog.find((v) => v.id === provider);
  return { vendor, model: vendor?.models.find((m) => m.id === id) };
});

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.catalog;
  return props.catalog
    .map((vendor) => ({
      ...vendor,
      models: vendor.models.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          vendor.name.toLowerCase().includes(q),
      ),
    }))
    .filter((vendor) => vendor.models.length > 0);
});

function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
}
function select(model: string) {
  emit("update:model", model);
  open.value = false;
}
function onDocDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
watch(open, (isOpen) => {
  if (isOpen) {
    query.value = "";
    void nextTick(() => searchRef.value?.focus());
    document.addEventListener("pointerdown", onDocDown);
  } else {
    document.removeEventListener("pointerdown", onDocDown);
  }
});
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocDown));

// 选择器标签：品牌名 + 模型名，均来自 catalog 数据
const label = computed(() => {
  const { vendor, model } = current.value;
  if (!vendor || !model) return props.model;
  return `${vendor.name} · ${model.name}`;
});
</script>

<template>
  <div ref="root" class="picker">
    <button
      type="button"
      class="selector"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="`模型：${label}`"
      @click="toggle"
    >
      <VendorMark :name="current.vendor?.name ?? ''" :size="12" />
      <span class="selector-name">{{ label }}</span>
      <ChevronDown :size="12" class="selector-chevron" />
    </button>

    <div v-if="open" class="popover" role="listbox" aria-label="选择模型">
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
            <button
              v-for="m in vendor.models"
              :key="m.id"
              type="button"
              role="option"
              :aria-selected="`${vendor.id}/${m.id}` === model"
              class="model-item"
              :class="{ 'model-item-current': `${vendor.id}/${m.id}` === model }"
              @click="select(`${vendor.id}/${m.id}`)"
            >
              <VendorMark :name="vendor.name" :size="14" />
              <span class="model-body">
                <span class="model-name">{{ m.name }}</span>
                <span v-if="m.description" class="model-desc">{{ m.description }}</span>
              </span>
              <span v-if="m.thinkingLevels.length === 1" class="model-tag">默认</span>
              <Check v-if="`${vendor.id}/${m.id}` === model" :size="13" class="model-check" />
            </button>
          </div>
        </template>
        <div v-else class="empty">没有匹配的模型</div>
      </div>
    </div>
  </div>
</template>

<!-- 供应商品牌标记：中性首字母圆点；品牌名与模型描述均来自 catalog 数据，不硬编码 -->
<script lang="ts">
import { defineComponent, h } from "vue";

export const VendorMark = defineComponent({
  name: "VendorMark",
  props: { name: { type: String, default: "" }, size: { type: Number, default: 12 } },
  setup(props) {
    return () => {
      const size = props.size;
      return h(
        "span",
        {
          class: "vendor-fallback",
          style: {
            width: `${size}px`,
            height: `${size}px`,
            fontSize: `${Math.max(8, size * 0.6)}px`,
          },
        },
        props.name.charAt(0).toUpperCase() || "?",
      );
    };
  },
});
</script>

<style scoped>
.picker {
  position: relative;
  display: flex;
}
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
.popover {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 30;
  width: 280px;
  padding: 4px;
  background: var(--surface);
  border: 0.5px solid var(--hairline);
  border-radius: 12px;
  box-shadow: var(--shadow-popover);
  transform-origin: bottom left;
  animation: popover-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes popover-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
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
.model-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.model-item:hover {
  background: var(--canvas-soft);
}
.model-item-current {
  color: var(--primary);
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
.vendor-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  border-radius: 999px;
  background: var(--canvas-soft);
  color: var(--ink-muted);
  font-weight: 600;
  line-height: 1;
}
</style>
