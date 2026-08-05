<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent @close-auto-focus="onCloseAutoFocus">
      <DialogHeader>
        <DialogTitle>删除 Session</DialogTitle>
        <DialogDescription>
          删除“{{ props.session.name || props.session.id.slice(0, 8) }}”的本地索引？此操作不可撤销。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <button class="secondary" type="button" @click="emit('close')">取消</button>
        <button class="danger" type="button" @click="emit('delete')">删除</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import type { SessionDto } from "../../api/index.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog/index.js";

const props = defineProps<{
  session: SessionDto;
  /** 触发 kebab 按钮：dialog 关闭后焦点回落到它。 */
  trigger: HTMLElement | null;
}>();

const emit = defineEmits<{
  close: [];
  delete: [];
}>();

// reka 关闭 dialog 前触发：焦点回触发 kebab（阻止默认聚焦 body）
function onCloseAutoFocus(event: Event) {
  event.preventDefault();
  props.trigger?.focus();
}
</script>

<style scoped>
.danger {
  background: var(--danger);
  color: var(--on-primary);
}
</style>
