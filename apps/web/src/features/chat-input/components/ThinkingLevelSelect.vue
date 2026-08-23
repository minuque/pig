<template>
  <button
    v-if="levels.length <= 3"
    type="button"
    class="selector"
    :disabled="disabled"
    :aria-label="`思考强度：${label}`"
    @mousedown.prevent
    @click="cycle"
  >
    <svg class="bars" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="1" y="9" width="3" height="4" rx="0.8" :opacity="barOpacities[0]" />
      <rect x="5.5" y="5.5" width="3" height="7.5" rx="0.8" :opacity="barOpacities[1]" />
      <rect x="10" y="2" width="3" height="11" rx="0.8" :opacity="barOpacities[2]" />
    </svg>
    <span class="level-name">{{ label }}</span>
  </button>

  <DropdownMenu v-else :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="selector"
        :disabled="disabled"
        :aria-label="`思考强度：${label}`"
      >
        <svg class="bars" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="1" y="9" width="3" height="4" rx="0.8" :opacity="barOpacities[0]" />
          <rect x="5.5" y="5.5" width="3" height="7.5" rx="0.8" :opacity="barOpacities[1]" />
          <rect x="10" y="2" width="3" height="11" rx="0.8" :opacity="barOpacities[2]" />
        </svg>
        <span class="level-name">{{ label }}</span>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent
      side="top"
      align="start"
      :side-offset="6"
      aria-label="思考强度"
      class="z-30 min-w-[110px] p-[3px] rounded-[10px] shadow-(--shadow-popover) data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]"
      @open-auto-focus="onOpenAutoFocus"
      @pointer-down-outside="suppressFocusRestore"
      @close-auto-focus="onCloseAutoFocus"
    >
      <DropdownMenuItem
        v-for="item in levels"
        :key="item"
        class="h-[26px] gap-[6px] rounded-[7px] px-[7px] py-0 text-[11px] font-medium active:scale-100 cursor-pointer hover:bg-canvas-soft focus:bg-canvas-soft data-[current]:text-primary"
        :data-current="item === level ? '' : undefined"
        @select="select(item)"
      >
        <span class="menu-name">{{ item.charAt(0).toUpperCase() + item.slice(1) }}</span>
        <Check v-if="item === level" :size="12" class="menu-check" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script lang="ts">
/** 按档位数组循环；当前档不在列表时落到 0。 */
export function nextThinkingLevel(levels: readonly string[], current: string): string {
  if (levels.length === 0) return current;
  const i = levels.indexOf(current);
  return levels[i < 0 ? 0 : (i + 1) % levels.length]!;
}

/** 三根条的透明度：由当前 index 相对档位数映射，不写死档名。 */
export function thinkingBarOpacities(index: number, count: number): [number, number, number] {
  const n = Math.max(count, 1);
  const i = Math.max(index, 0);
  const filled = n <= 1 ? 2 : Math.round((i / Math.max(n - 1, 1)) * 2);
  return [0, 1, 2].map((bar) => (bar <= filled ? 1 : 0.28)) as [number, number, number];
}
</script>

<script setup lang="ts">
import { Check } from "lucide-vue-next";
import { computed } from "vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@components/ui/dropdown-menu/index.js";

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

const label = computed(() => props.level.charAt(0).toUpperCase() + props.level.slice(1));
const currentIndex = computed(() => props.levels.indexOf(props.level));
const barOpacities = computed(() =>
  thinkingBarOpacities(Math.max(currentIndex.value, 0), props.levels.length),
);

function cycle() {
  emit("update:level", nextThinkingLevel(props.levels, props.level));
}

function select(item: string) {
  emit("update:level", item);
}

function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]')?.focus();
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
.bars {
  flex: none;
  fill: currentColor;
}
.level-name {
  text-transform: capitalize;
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
