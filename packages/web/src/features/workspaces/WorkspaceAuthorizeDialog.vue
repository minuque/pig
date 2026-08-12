<template>
  <Dialog :open="show" @update:open="onOpenChange">
    <DialogContent @close-auto-focus="onCloseAutoFocus">
      <DialogHeader>
        <DialogTitle>授权 Workspace</DialogTitle>
        <DialogDescription>
          选择一个本地文件夹授权给 Gateway。授权后该目录将作为新 Workspace 出现在左侧导航。
        </DialogDescription>
      </DialogHeader>

      <section
        v-if="!previewPath"
        class="candidates"
        aria-labelledby="candidates-title"
        aria-live="polite"
        :aria-busy="candidatesLoading"
      >
        <h2 id="candidates-title" class="eyebrow">最近 Pi 目录</h2>
        <p v-if="candidatesLoading" class="candidates-note">正在加载最近使用的目录…</p>
        <p v-else-if="candidatesError" class="candidates-note">
          无法加载最近目录，仍可选择文件夹。
        </p>
        <p v-else-if="!candidates.length" class="candidates-note">没有找到最近使用的目录。</p>
        <ul v-else class="candidate-list">
          <li v-for="candidate in candidates" :key="candidate.canonicalPath">
            <button
              type="button"
              class="candidate-row"
              :disabled="authorizing"
              @click="emit('select-candidate', candidate)"
            >
              <span class="candidate-name">{{ candidate.name }}</span>
              <span class="candidate-path">{{ candidate.canonicalPath }}</span>
            </button>
          </li>
        </ul>
      </section>
      <p v-else class="preview">
        <strong>将授权：</strong><span class="mono">{{ previewPath }}</span>
      </p>
      <div v-if="authorizeError" class="notice error" role="alert">{{ authorizeError }}</div>

      <DialogFooter>
        <button type="button" class="secondary" :disabled="authorizing" @click="emit('close')">
          取消
        </button>
        <button
          v-if="!previewPath"
          ref="pickerButton"
          type="button"
          :disabled="authorizing"
          @click="emit('preview')"
        >
          {{ authorizing ? "选择中…" : candidates.length ? "选择其他文件夹" : "选择文件夹" }}
        </button>
        <template v-else>
          <button type="button" class="secondary" :disabled="authorizing" @click="emit('clear')">
            重新选择
          </button>
          <button type="button" :disabled="authorizing" @click="emit('confirm')">
            {{ authorizing ? "授权中…" : "确认并授权" }}
          </button>
        </template>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import type { WorkspaceCandidate } from "@pig/contracts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog/index.js";

const props = defineProps<{
  show: boolean;
  previewPath: string;
  authorizing: boolean;
  authorizeError: string;
  candidates: WorkspaceCandidate[];
  candidatesLoading: boolean;
  candidatesError: string;
}>();

const emit = defineEmits<{
  close: [];
  preview: [];
  clear: [];
  confirm: [];
  "select-candidate": [candidate: WorkspaceCandidate];
}>();

const pickerButton = ref<HTMLButtonElement>();
let returnFocus: HTMLElement | null = null;
watch(
  () => props.show,
  async (show) => {
    if (show) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      await nextTick();
      pickerButton.value?.focus();
    }
  },
);

function onOpenChange(open: boolean) {
  if (!open) emit("close");
}
function onCloseAutoFocus(event: Event) {
  event.preventDefault();
  void nextTick(() => {
    returnFocus?.focus();
    returnFocus = null;
  });
}
</script>

<style scoped>
.candidates {
  display: grid;
  gap: var(--spacing-xs);
}
.candidates-note {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-caption);
}
.candidate-list {
  display: grid;
  gap: var(--spacing-xxs);
  max-height: var(--size-candidate-list);
  margin: 0;
  padding: 0 var(--spacing-xxs) 0 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
}
.candidate-row {
  display: grid;
  gap: var(--spacing-xxs);
  width: 100%;
  min-height: var(--size-control);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 0;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--ink);
  text-align: left;
  transition:
    background var(--duration-fast) var(--ease-smooth),
    transform var(--duration-fast) var(--ease-smooth);
}
.candidate-row:hover {
  background: var(--canvas-soft);
}
.candidate-name {
  font-weight: var(--font-weight-medium);
}
.candidate-path {
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: var(--text-caption);
  overflow-wrap: anywhere;
}
.preview {
  display: grid;
  gap: var(--spacing-xs);
}
.eyebrow {
  margin: 0;
  color: var(--ink-muted);
  font-size: var(--text-eyebrow);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--tracking-eyebrow);
}
@media (pointer: coarse) {
  .candidate-row {
    min-height: calc(var(--size-control) + var(--spacing-xxs));
  }
}
</style>
