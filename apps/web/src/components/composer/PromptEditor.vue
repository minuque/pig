<template>
  <div class="frame">
    <slot name="chips" />
    <div class="editor-wrap">
      <div
        ref="editor"
        class="field"
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        :aria-label="ariaLabel"
        :data-empty="!hasText || undefined"
        :data-placeholder="placeholder"
        @input="onEditorInput"
        @keydown="onEditorKeydown"
      ></div>
    </div>
    <div class="row">
      <div class="left">
        <slot name="left" />
      </div>
      <div class="right">
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/** 键盘守卫：仅裸 Enter 触发提交；Shift+Enter 换行、IME 组合期间一律放行。 */
export function shouldSubmitOnKeydown(e: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing;
}
</script>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "Ask AI Agent",
    ariaLabel: "Ask AI Agent",
  },
);

/** 与外部 prompt 双向绑定：输入/增强结果写回外部，外部草稿恢复时同步进编辑器 */
const prompt = defineModel<string>("prompt", { required: true });

const emit = defineEmits<{
  /** 裸 Enter：是否真正发送由父组件守卫 */
  submit: [];
}>();

const editor = ref<HTMLElement | null>(null);

const hasText = computed(() => prompt.value.trim().length > 0);

/** 聚焦并把光标移到末尾 */
function focusEnd() {
  const el = editor.value;
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}
/** 供父组件（发送/steer/选文件后）重新聚焦编辑器 */
function focus() {
  editor.value?.focus();
}

function syncFromEditor() {
  const el = editor.value;
  if (!el) return;
  prompt.value = el.textContent ?? "";
}
const escapeHtml = (str: string) =>
  str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

// 外部改写 prompt（draft 恢复等）时同步进编辑器。
// 挂载时也同步一次：重挂载且 prompt 初始非空时，保证编辑器显示既有草稿（watch 非 immediate，setup 阶段 editor 尚未挂载）。
function syncFromPrompt() {
  const el = editor.value;
  if (!el) return;
  if (el.textContent !== prompt.value) {
    const sel = window.getSelection();
    const focused = sel && el.contains(sel.anchorNode);
    el.innerHTML = escapeHtml(prompt.value);
    if (focused) focusEnd();
  }
}
watch(prompt, syncFromPrompt);
onMounted(syncFromPrompt);

function onEditorInput() {
  syncFromEditor();
}
function onEditorKeydown(e: KeyboardEvent) {
  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault();
    emit("submit");
  }
}

defineExpose({ focus });
</script>

<style scoped>
.frame {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 10px 10px;
  background: var(--surface);
  border: 0.5px solid transparent;
  border-radius: 12px;
  box-shadow: var(--shadow-card);
}
.frame:has(.chips) {
  padding-top: 10px;
}

.editor-wrap {
  position: relative;
}
.field {
  position: relative;
  width: 100%;
  margin: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.12px;
  min-height: 18px;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
.field:focus-visible {
  outline: 0;
  box-shadow: none;
}
.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
.field[data-empty]::before {
  content: attr(data-placeholder);
  position: absolute;
  top: 0;
  left: 0;
  color: var(--ink);
  opacity: 0.5;
  pointer-events: none;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
