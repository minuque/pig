<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ArrowUp, Image as ImageIcon, Loader2, Paperclip, Plus, X } from "lucide-vue-next";
import type { ModelPreset, ModelVendor } from "@no-pi-no-gang/contracts";
import ModelPicker from "../../components/composer/ModelPicker.vue";
import ThinkingLevelSelect from "../../components/composer/ThinkingLevelSelect.vue";
import { useModelPresetBinding } from "../../components/composer/model-preset.js";
import { useEnhance } from "../../components/composer/use-enhance.js";
import { useAttachments } from "../../components/composer/use-attachments.js";
import RunStatusBadge from "./RunStatusBadge.vue";
import type { UiRun } from "./run-state.js";

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
    catalog: ModelVendor[];
    activeRun?: UiRun | undefined;
    queuedCount?: number;
    cancelling?: Set<string>;
    unavailable?: boolean;
    runError?: string;
    onEnhance?: ((prompt: string, signal?: AbortSignal) => Promise<string>) | undefined;
    /** 外部禁用发送（如 welcome 的 workspace/预设/提交中守卫） */
    sendDisabled?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    /** 嵌入其他布局时以 div 渲染，避免嵌套 form */
    bare?: boolean;
  }>(),
  {
    queuedCount: 0,
    cancelling: () => new Set(),
    unavailable: false,
    runError: "",
    sendDisabled: false,
    placeholder: "Ask AI Agent",
    ariaLabel: "Ask AI Agent",
    bare: false,
  },
);
// mock 为默认实现，gateway 接入时替换为真实请求
const onEnhance = props.onEnhance ?? mockEnhance;

const prompt = defineModel<string>("prompt", { required: true });
const preset = defineModel<ModelPreset | undefined>("preset");

const emit = defineEmits<{
  send: [text: string];
  steer: [text: string];
  "cancel-run": [run: UiRun];
}>();

const { model, modelLevels, level } = useModelPresetBinding(props.catalog, preset);
const { phase, enhancing, pendingHTML, enhance, revert, dispose } = useEnhance(onEnhance);
const {
  attachments,
  exitingAtt,
  menuOpen,
  plusWrap,
  fileRef,
  openPicker,
  onFiles,
  removeAttachment,
  composeText,
  clear,
} = useAttachments();

// 与 prompt model 双向同步：输入、清空（发送/steer 后）都写回外部
const value = computed<string>({
  get: () => prompt.value,
  set: (v) => {
    prompt.value = v;
  },
});
const pillMounted = ref(false);
const pillExiting = ref(false);
let pillTimer: ReturnType<typeof setTimeout> | null = null;

const editor = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
let flipFrom: number | null = null;
let savedRange: Range | null = null;

const hasText = computed(() => value.value.trim().length > 0);
const sendActive = computed(
  () => hasText.value && !enhancing.value && !props.unavailable && !props.sendDisabled,
);
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
  savedRange = range.cloneRange();
}
function syncFromEditor() {
  const el = editor.value;
  if (!el) return;
  value.value = el.textContent ?? "";
}
const escapeHtml = (str: string) =>
  str.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);

// 外部改写 prompt（draft 恢复等）时同步进编辑器
watch(prompt, (v) => {
  const el = editor.value;
  if (el && el.textContent !== v) {
    const sel = window.getSelection();
    const focused = sel && el.contains(sel.anchorNode);
    el.innerHTML = escapeHtml(v);
    if (focused) focusEnd();
  }
});

function onEditorInput() {
  syncFromEditor();
  if (phase.value === "enhanced") phase.value = "idle";
}
function onEditorKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    send();
  }
}
function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount && editor.value && editor.value.contains(sel.anchorNode)) {
    savedRange = sel.getRangeAt(0).cloneRange();
  }
}

function handleFiles(e: Event) {
  onFiles(e);
  nextTick(() => editor.value?.focus());
}
function send() {
  if (!sendActive.value) return;
  const text = composeText(value.value);
  clearComposer();
  emit("send", text);
}
function steer() {
  if (!props.activeRun || !hasText.value || props.unavailable) return;
  const text = composeText(value.value);
  clearComposer();
  emit("steer", text);
}
function clearComposer() {
  if (editor.value) editor.value.innerHTML = "";
  value.value = "";
  phase.value = "idle";
  clear();
  nextTick(() => editor.value?.focus());
}

// 增强结果（或失败回退原文）写入编辑器，并做高度过渡
watch(phase, async () => {
  if (enhancing.value || pendingHTML.value === null) return;
  await nextTick();
  if (!editor.value) return;
  editor.value.innerHTML = escapeHtml(pendingHTML.value);
  pendingHTML.value = null;
  syncFromEditor();
  requestAnimationFrame(focusEnd);

  const el = frame.value;
  const from = flipFrom;
  flipFrom = null;
  if (!el || from === null) return;
  const to = el.offsetHeight;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || from === to) return;
  el.style.height = from + "px";
  el.style.overflow = "hidden";
  void el.offsetHeight;
  el.style.transition = "height 200ms cubic-bezier(0.22, 1, 0.36, 1)";
  el.style.height = to + "px";
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    el.style.transition = "";
    el.style.height = "";
    el.style.overflow = "";
    el.removeEventListener("transitionend", finish);
  };
  el.addEventListener("transitionend", finish);
  setTimeout(finish, 260);
});

onBeforeUnmount(() => {
  dispose();
  if (pillTimer) clearTimeout(pillTimer);
});
</script>

<template>
  <component
    :is="bare ? 'div' : 'form'"
    class="prompt"
    :class="{ bare, disabled: unavailable }"
    @submit.prevent="send"
  >
    <div v-if="activeRun && !unavailable" class="c-status">
      <RunStatusBadge :status="activeRun.status" />
      <span v-if="queuedCount" class="c-note">队列 {{ queuedCount }}（FIFO）</span>
      <span style="flex: 1"></span>
      <button
        v-if="activeRun.status === 'running'"
        type="button"
        class="secondary"
        :disabled="!hasText"
        @click="steer"
      >
        Steer
      </button>
      <button
        type="button"
        class="secondary"
        :disabled="cancelling.has(activeRun.id)"
        @click="emit('cancel-run', activeRun)"
      >
        {{ cancelling.has(activeRun.id) ? "取消中…" : "取消 Run" }}
      </button>
    </div>

    <input ref="fileRef" type="file" multiple hidden @change="handleFiles" />
    <div ref="frame" class="frame" :data-enhancing="enhancing || undefined">
      <div v-if="attachments.length" class="chips">
        <span
          v-for="att in attachments"
          :key="att.id"
          class="chip"
          :data-exit="exitingAtt.includes(att.id) || undefined"
        >
          <span class="chip-icon">
            <ImageIcon v-if="att.kind === 'image'" :size="13" />
            <Paperclip v-else :size="13" />
          </span>
          <span class="chip-name">{{ att.name }}</span>
          <button
            type="button"
            class="chip-remove"
            :aria-label="'Remove ' + att.name"
            @click="removeAttachment(att.id)"
          >
            <X :size="11" />
          </button>
        </span>
      </div>

      <div class="editor-wrap">
        <div v-if="enhancing" class="enhancing-text" aria-live="polite">
          {{ value }}
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
          @keyup="saveSelection"
          @mouseup="saveSelection"
          @blur="saveSelection"
        ></div>
      </div>

      <div class="row">
        <div class="left">
          <div ref="plusWrap" class="plus-wrap">
            <button
              type="button"
              class="icon-btn plus"
              :data-open="menuOpen || undefined"
              aria-label="添加附件"
              :aria-expanded="menuOpen"
              :disabled="unavailable"
              @click="menuOpen = !menuOpen"
            >
              <span class="plus-icon"><Plus :size="14" /></span>
            </button>

            <div v-if="menuOpen" class="menu" role="menu">
              <button type="button" role="menuitem" class="menu-item" @click="openPicker('image')">
                <span class="menu-icon"><ImageIcon :size="14" /></span>
                <span class="menu-name">添加图片</span>
              </button>
              <button type="button" role="menuitem" class="menu-item" @click="openPicker('file')">
                <span class="menu-icon"><Paperclip :size="14" /></span>
                <span class="menu-name">添加文件</span>
              </button>
            </div>
          </div>

          <slot name="left" />

          <ModelPicker v-model:model="model" :catalog="catalog" :disabled="unavailable" />
          <ThinkingLevelSelect
            v-model:level="level"
            :levels="modelLevels"
            :disabled="unavailable"
          />
        </div>

        <div class="right">
          <span v-if="enhancing" class="icon-btn spinner-btn" aria-label="Enhancing prompt">
            <Loader2 class="spinner" :size="14" />
          </span>
          <button
            v-else-if="pillMounted"
            type="button"
            class="pill"
            :class="{ 'pill-exit': pillExiting }"
            @click="phase === 'enhanced' ? revert() : enhance(value)"
          >
            {{ phase === "enhanced" ? "Revert" : "Enhance Prompt" }}
          </button>
          <button
            type="button"
            class="icon-btn send"
            :class="{ 'send-active': sendActive }"
            :aria-label="activeRun && !unavailable ? '排队发送' : '发送'"
            :title="activeRun && !unavailable ? '排队发送' : '发送'"
            :disabled="!sendActive"
            @click="send"
          >
            <ArrowUp :size="14" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="unavailable" class="c-reason" role="status">
      Unavailable Session 拒绝新的 Run — 源无法安全恢复，可查看最后验证的信息。
    </p>
    <div v-if="runError" class="notice error" role="alert">{{ runError }}</div>
    <div v-if="activeRun" class="actions composer-actions">
      <span class="badge-preset mono"
        >{{ preset?.model ?? "—" }} · {{ preset?.thinkingLevel ?? "—" }}</span
      >
      <span class="c-note">{{
        unavailable
          ? "模型与 thinking level 在 admission 时冻结"
          : activeRun
            ? "Steer 纠偏当前 Run，不创建新 Run；发送则按 FIFO 排队"
            : "模型与 thinking level 在 admission 时冻结"
      }}</span>
    </div>
  </component>
</template>

<style scoped>
.prompt {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.prompt:not(.bare) {
  width: min(var(--size-content), 100%);
  margin: auto;
}
.prompt.disabled {
  background: var(--canvas-soft);
}
.c-status {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}
.c-note {
  font-size: var(--text-caption);
  color: var(--ink-muted);
}
.c-reason {
  margin: var(--spacing-sm) 0;
  font-size: var(--text-caption);
  color: var(--danger);
}
.composer-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-top: var(--spacing-xs);
}
.badge-preset {
  font-size: var(--text-caption);
  color: var(--ink-secondary);
}
.notice {
  padding: var(--spacing-md);
  background: var(--canvas-soft);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-md);
}
.error {
  border-left: var(--border-width-emphasis) solid var(--danger);
  margin-top: var(--spacing-sm);
}
.secondary {
  font: inherit;
  font-size: var(--text-caption);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--hairline);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.secondary:hover:not(:disabled) {
  background: var(--canvas-soft);
}
.secondary:disabled {
  opacity: 0.5;
  cursor: default;
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

@property --pi-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
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

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: -6px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  padding: 3px 4px 3px 5px;
  border-radius: 999px;
  background: var(--surface);
  border: 0.5px solid var(--hairline);
  color: var(--ink);
  font-size: 11px;
  line-height: 14px;
  animation: pi-chip-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
.chip[data-exit] {
  animation: pi-pill-out 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
  pointer-events: none;
}
.chip-icon {
  display: inline-flex;
  flex: none;
  color: var(--ink-faint);
}
.chip-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: -2px;
  width: 15px;
  height: 15px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  transition:
    background 150ms cubic-bezier(0.22, 1, 0.36, 1),
    color 150ms cubic-bezier(0.22, 1, 0.36, 1);
}
.chip-remove:hover {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  color: var(--ink);
}
@keyframes pi-chip-in {
  from {
    opacity: 0;
    transform: translateY(4px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
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
.plus-wrap {
  position: relative;
  display: flex;
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
}

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

.send {
  color: var(--ink-faint);
}
.send:disabled {
  cursor: default;
}
.send:disabled:active::before {
  transform: none;
}
.send-active {
  color: var(--inverse-fg);
}
.send-active::before {
  background: var(--inverse-bg);
}
.send-active:hover:not(:disabled)::before {
  background: var(--inverse-bg-hover);
}

.spinner-btn {
  cursor: default;
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

.menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  z-index: 20;
  width: 150px;
  padding: 3px;
  background: var(--surface);
  border: 0.5px solid var(--hairline);
  border-radius: 10px;
  box-shadow: var(--shadow-popover);
  transform-origin: bottom left;
  animation: pi-menu-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
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
  line-height: 12px;
  text-align: left;
  cursor: pointer;
}
.menu-item:hover {
  background: var(--canvas-soft);
}
.menu-item:active {
  background: color-mix(in srgb, var(--ink) 9%, transparent);
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
@keyframes pi-menu-in {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-btn::before,
  .pill::before,
  .menu-item,
  .chip-remove,
  .plus-icon {
    transition: none;
  }
  .chip,
  .chip[data-exit],
  .pill,
  .pill.pill-exit,
  .menu {
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
