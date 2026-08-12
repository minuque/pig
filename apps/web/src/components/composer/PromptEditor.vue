<template>
  <div class="frame" :data-enhancing="enhancing || undefined">
    <slot name="chips" />
    <div class="editor-wrap">
      <div v-if="enhancing" class="enhancing-text" aria-live="polite">
        {{ prompt }}
      </div>
      <div
        v-else
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
        <span v-if="enhancing" class="spinner-btn" aria-label="Enhancing prompt">
          <Loader2 class="spinner" :size="14" />
        </span>
        <button
          v-else-if="pillMounted"
          type="button"
          class="pill"
          :class="{ 'pill-exit': pillExiting }"
          @click="phase === 'enhanced' ? revert() : enhance(prompt)"
        >
          {{ enhanceLabel(phase) }}
        </button>
        <slot name="right" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import type { EnhancePhase } from "./use-enhance.js";

/** 键盘守卫：仅裸 Enter 触发提交；Shift+Enter 换行、IME 组合期间一律放行。 */
export function shouldSubmitOnKeydown(e: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing;
}

/** Enhance 按钮文案：enhanced 态切换为 Revert。 */
export function enhanceLabel(phase: EnhancePhase): string {
  return phase === "enhanced" ? "Revert" : "Enhance Prompt";
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Loader2 } from "lucide-vue-next";
import { useEnhance } from "./use-enhance.js";

const ENHANCED =
  "This is an example prompt — rewritten to be clear and specific: state the goal, add the relevant context and constraints, define the expected output format and tone, and note any assumptions. Ask a clarifying question first if key details are missing.";

/**
 * Integration seam: replace the mock body with a real request to your
 * model/API. It only needs to resolve to the enhanced prompt string.
 */
async function mockEnhance(prompt: string, signal?: AbortSignal): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return ENHANCED;
}

const props = withDefaults(
  defineProps<{
    /** Enhance 接入扩展点：返回增强后的 prompt；缺省走 mock 实现 */
    onEnhance?: ((prompt: string, signal?: AbortSignal) => Promise<string>) | undefined;
    placeholder?: string;
    ariaLabel?: string;
  }>(),
  {
    placeholder: "Ask AI Agent",
    ariaLabel: "Ask AI Agent",
  },
);
// mock 为默认实现，gateway 接入时替换为真实请求
const onEnhance = props.onEnhance ?? mockEnhance;

/** 与外部 prompt 双向绑定：输入/增强结果写回外部，外部草稿恢复时同步进编辑器 */
const prompt = defineModel<string>("prompt", { required: true });
/** 增强中状态单向暴露给父组件（发送按钮禁用等编排需要），由本组件写入 */
const enhancing = defineModel<boolean>("enhancing");

const emit = defineEmits<{
  /** 裸 Enter：是否真正发送由父组件守卫 */
  submit: [];
}>();

const { phase, pendingHTML, enhance, revert, dispose } = useEnhance(onEnhance);

// 同步 enhancing 状态给父组件
watch(
  phase,
  (p) => {
    enhancing.value = p === "enhancing";
  },
  { immediate: true },
);

const pillMounted = ref(false);
const pillExiting = ref(false);
let pillTimer: ReturnType<typeof setTimeout> | null = null;

const editor = ref<HTMLElement | null>(null);

const hasText = computed(() => prompt.value.trim().length > 0);
const showPill = computed(() => hasText.value && !enhancing.value);

watch(
  showPill,
  (show) => {
    if (show) {
      pillMounted.value = true;
      pillExiting.value = false;
      if (pillTimer) {
        clearTimeout(pillTimer);
        pillTimer = null;
      }
      return;
    }
    if (!pillMounted.value) return;
    if (enhancing.value) {
      pillMounted.value = false;
      pillExiting.value = false;
      return;
    }
    pillExiting.value = true;
    if (pillTimer) clearTimeout(pillTimer);
    pillTimer = setTimeout(() => {
      pillMounted.value = false;
      pillExiting.value = false;
      pillTimer = null;
    }, 200);
  },
  { immediate: true },
);

/** 聚焦并把光标移到末尾（增强结果写入后、外部同步且编辑器已聚焦时） */
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

// 外部改写 prompt（draft 恢复等）时同步进编辑器；清空时复位增强状态。
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
  if (prompt.value === "") phase.value = "idle";
}
watch(prompt, syncFromPrompt);
onMounted(syncFromPrompt);

function onEditorInput() {
  syncFromEditor();
  if (phase.value === "enhanced") phase.value = "idle";
}
function onEditorKeydown(e: KeyboardEvent) {
  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault();
    emit("submit");
  }
}

// 增强结果（或失败回退原文）写入编辑器并聚焦
watch(phase, async () => {
  if (enhancing.value || pendingHTML.value === null) return;
  await nextTick();
  if (!editor.value) return;
  editor.value.innerHTML = escapeHtml(pendingHTML.value);
  pendingHTML.value = null;
  syncFromEditor();
  requestAnimationFrame(focusEnd);
});

defineExpose({ focus });

onBeforeUnmount(() => {
  dispose();
  if (pillTimer) clearTimeout(pillTimer);
});
</script>

<style scoped>
@property --pi-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
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
.frame[data-enhancing] {
  border-color: transparent;
}
.frame[data-enhancing]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  border: 0.75px solid transparent;
  background: conic-gradient(from var(--pi-angle), #2b7fff, #8b5cf6, #d946ef, #22d3ee, #2b7fff)
    border-box;
  -webkit-mask:
    linear-gradient(#000 0 0) padding-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation:
    pi-border-spin 1.1s linear infinite,
    pi-border-in 220ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
.dark .frame[data-enhancing]::after {
  background: conic-gradient(from var(--pi-angle), #3b6fb5, #6b5aa6, #9a4f96, #3a8a9a, #3b6fb5)
    border-box;
}
@keyframes pi-border-spin {
  to {
    --pi-angle: 360deg;
  }
}
@keyframes pi-border-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

.enhancing-text {
  font-size: 12px;
  line-height: 18px;
  letter-spacing: -0.12px;
  word-break: break-word;
  color: transparent;
  -webkit-text-fill-color: transparent;
  background: linear-gradient(
    90deg,
    var(--ink) 0%,
    var(--ink) 30%,
    color-mix(in srgb, var(--ink) 45%, transparent) 45%,
    color-mix(in srgb, var(--ink) 45%, transparent) 55%,
    var(--ink) 70%,
    var(--ink) 100%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: pi-shine 2.25s cubic-bezier(0.25, 0.1, 0.25, 1) infinite;
}
@keyframes pi-shine {
  0%,
  18% {
    background-position: 100% 0;
  }
  82%,
  100% {
    background-position: 0% 0;
  }
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

.pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 11px;
  line-height: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  animation: pi-pill-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.pill::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ink) 6%, transparent);
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.pill:hover::before {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}
.pill:active::before {
  transform: scale(0.98);
}
@keyframes pi-pill-in {
  from {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
}
.pill.pill-exit {
  animation: pi-pill-out 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
@keyframes pi-pill-out {
  from {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: scale(0.96);
    filter: blur(2px);
  }
}

.spinner-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: none;
  color: var(--ink-faint);
  cursor: default;
  pointer-events: none;
}
.spinner {
  position: relative;
  display: inline-flex;
  color: var(--ink-faint);
  animation: pi-spin 0.7s linear infinite;
}
@keyframes pi-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pill::before {
    transition: none;
  }
  .pill,
  .pill.pill-exit {
    animation: none;
  }
  .enhancing-text,
  .frame[data-enhancing]::after {
    animation: none;
  }
  .spinner {
    animation-duration: 1.4s;
  }
}
</style>
