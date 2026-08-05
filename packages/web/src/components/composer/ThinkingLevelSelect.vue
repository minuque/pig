<script setup lang="ts">
import { ChevronDown, Check } from "lucide-vue-next";
import { computed, onBeforeUnmount, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    levels: string[];
    level: string;
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  "update:level": [value: string];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

// 联动：模型切换后当前 level 不可用时自动修正为第一个可用值
watch(
  () => props.levels,
  (levels) => {
    if (levels.length && !levels.includes(props.level)) emit("update:level", levels[0]!);
  },
  { immediate: true },
);

const label = computed(() => props.level.charAt(0).toUpperCase() + props.level.slice(1));

function toggle() {
  if (props.disabled || props.levels.length < 2) return;
  open.value = !open.value;
}
function onDocDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) open.value = false;
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener("pointerdown", onDocDown);
  else document.removeEventListener("pointerdown", onDocDown);
});
onBeforeUnmount(() => document.removeEventListener("pointerdown", onDocDown));
</script>

<template>
  <div ref="root" class="level">
    <button
      type="button"
      class="selector"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="`思考强度：${label}`"
      @click="toggle"
    >
      <span class="level-name">{{ label }}</span>
      <ChevronDown :size="12" class="level-chevron" />
    </button>

    <div v-if="open" class="menu" role="listbox" aria-label="思考强度">
      <button
        v-for="item in levels"
        :key="item"
        type="button"
        role="option"
        :aria-selected="item === level"
        class="menu-item"
        :class="{ 'menu-item-current': item === level }"
        @click="
          emit('update:level', item);
          open = false;
        "
      >
        <span class="menu-name">{{ item.charAt(0).toUpperCase() + item.slice(1) }}</span>
        <Check v-if="item === level" :size="12" class="menu-check" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.level {
  position: relative;
  display: flex;
}
.selector {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
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
.level-name {
  text-transform: capitalize;
}
.level-chevron {
  flex: none;
  opacity: 0.55;
}
.menu {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  z-index: 30;
  min-width: 110px;
  padding: 3px;
  background: var(--surface);
  border: 0.5px solid var(--hairline);
  border-radius: 10px;
  box-shadow: var(--shadow-popover);
  transform-origin: bottom left;
  animation: menu-in 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes menu-in {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: 26px;
  padding: 0 7px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--ink);
  font-size: 11px;
  font-weight: 425;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover {
  background: var(--canvas-soft);
}
.menu-item-current {
  color: var(--primary);
}
.menu-name {
  flex: 1 1 auto;
  text-transform: capitalize;
}
.menu-check {
  flex: none;
  color: var(--primary);
}
</style>
