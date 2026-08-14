<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="selector"
        :disabled="disabled || levels.length < 2"
        :aria-label="`思考强度：${label}`"
      >
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

function select(item: string) {
  emit("update:level", item);
  // 菜单由 reka-ui 在 select 后自动关闭
}

// 打开后聚焦第一项（阻止 reka 默认聚焦内容容器，Enter 即可直接选择）
function onOpenAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]')?.focus();
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
