<template>
  <div class="plus-wrap">
    <input ref="fileRef" type="file" multiple hidden @change="onFilesChange" />
    <DropdownMenu v-model:open="menuOpen" :modal="false">
      <DropdownMenuTrigger as-child>
        <button
          type="button"
          class="icon-btn plus"
          :data-open="menuOpen || undefined"
          aria-label="添加附件"
          :disabled="disabled"
        >
          <span class="plus-icon"><Plus :size="14" /></span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="top"
        align="start"
        class="z-30 w-[150px] p-[3px] rounded-[10px] shadow-(--shadow-popover) data-[state=open]:animate-[enter-blur_180ms_var(--ease-smooth)]"
        @open-auto-focus="onMenuAutoFocus"
        @pointer-down-outside="suppressFocusRestore"
        @close-auto-focus="onCloseAutoFocus"
      >
        <DropdownMenuItem
          class="h-[26px] gap-[6px] rounded-[7px] px-[7px] py-0 text-[11px] font-medium active:scale-100 cursor-pointer hover:bg-canvas-soft focus:bg-canvas-soft"
          @select="onSelect('image')"
        >
          <span class="menu-icon"><ImageIcon :size="14" /></span>
          <span class="menu-name">添加图片</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          class="h-[26px] gap-[6px] rounded-[7px] px-[7px] py-0 text-[11px] font-medium active:scale-100 cursor-pointer hover:bg-canvas-soft focus:bg-canvas-soft"
          @select="onSelect('file')"
        >
          <span class="menu-icon"><Paperclip :size="14" /></span>
          <span class="menu-name">添加文件</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Image as ImageIcon, Paperclip, Plus } from "lucide-vue-next";
import type { AttachmentKind } from "./use-attachments.js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu/index.js";

const props = withDefaults(
  defineProps<{
    /** 编辑器不可用时禁用附件添加 */
    disabled?: boolean;
  }>(),
  { disabled: false },
);

const emit = defineEmits<{
  /** 文件选择 change 事件：由父组件写入附件状态并聚焦编辑器 */
  files: [e: Event];
}>();

/** 附件菜单开关：由父组件（useAttachments）持有，reka 与父组件双向同步 */
const menuOpen = defineModel<boolean>("menuOpen", { default: false });

const fileRef = ref<HTMLInputElement | null>(null);

/** 选择图片/文件：设置 accept 与 fallback 类型后触发系统文件选择器（行为与旧实现一致） */
function onSelect(kind: AttachmentKind) {
  const input = fileRef.value;
  if (!input) return;
  input.accept = kind === "image" ? "image/*" : "";
  input.value = "";
  input.dataset.kind = kind;
  input.click();
  menuOpen.value = false;
}

function onFilesChange(e: Event) {
  emit("files", e);
}

// 附件菜单打开后聚焦第一项（阻止 reka 默认聚焦内容容器，Enter 即可直接选择）
function onMenuAutoFocus(event: Event) {
  event.preventDefault();
  (event.target as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]')?.focus();
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
.icon-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}
.icon-btn::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.icon-btn:hover:not(:disabled)::before {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.icon-btn:active:not(:disabled)::before {
  transform: scale(0.98);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.icon-btn > svg {
  position: relative;
}

.plus-icon {
  position: relative;
  display: inline-flex;
  transition: transform 200ms cubic-bezier(0.35, 1.55, 0.65, 1);
}
.plus[data-open]::before {
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}
.plus[data-open] .plus-icon {
  transform: rotate(45deg);
}

.menu-icon {
  display: inline-flex;
  flex: none;
  color: var(--ink-faint);
}
.menu-name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (prefers-reduced-motion: reduce) {
  .icon-btn::before,
  .plus-icon {
    transition: none;
  }
}
</style>
