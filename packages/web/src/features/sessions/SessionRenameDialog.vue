<template>
  <Dialog :open="true" @update:open="emit('close')">
    <DialogContent @close-auto-focus="onCloseAutoFocus">
      <DialogHeader>
        <DialogTitle>重命名 Session</DialogTitle>
        <DialogDescription>输入该 Session 的新名称。</DialogDescription>
      </DialogHeader>
      <input
        ref="nameInput"
        v-model="draft"
        class="rename-input"
        aria-label="Session 名称"
        maxlength="200"
        @keydown.enter="submit"
      />
      <DialogFooter>
        <button class="secondary" type="button" @click="emit('close')">取消</button>
        <button type="button" @click="submit">保存</button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script lang="ts">
/** 重命名提交守卫：空白名称拒绝提交。 */
export function canSubmitRename(draft: string): boolean {
  return draft.trim() !== "";
}
</script>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from "vue";
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
  rename: [name: string];
}>();

const draft = ref(props.session.name ?? "");
const nameInput = useTemplateRef<HTMLInputElement>("nameInput");

// 打开后自动聚焦并选中现有名称，便于直接覆盖输入
onMounted(() => {
  nameInput.value?.focus();
  nameInput.value?.select();
});

// reka 关闭 dialog 前触发：焦点回触发 kebab（阻止默认聚焦 body）
function onCloseAutoFocus(event: Event) {
  event.preventDefault();
  props.trigger?.focus();
}

function submit() {
  if (!canSubmitRename(draft.value)) return;
  emit("rename", draft.value.trim());
}
</script>

<style scoped>
.rename-input {
  display: block;
  width: 100%;
  margin: var(--spacing-md) 0;
}
</style>
