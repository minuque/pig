<template>
  <div class="chat-input" @mousedown="onChatInputMousedown">
    <div class="attach-tray" :data-open="$slots.chips ? '' : undefined">
      <div class="attach-inner">
        <div class="chips">
          <slot name="chips" />
        </div>
      </div>
    </div>
    <div class="glass-shell" :class="{ 'motion-card-glow': running }">
      <div class="glass-host">
        <div class="editor-wrap">
          <div
            ref="editor"
            class="field"
            contenteditable="plaintext-only"
            :data-empty="!hasText || undefined"
            :data-placeholder="placeholder"
            @input="syncFromEditor"
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}

const props = withDefaults(
  defineProps<{
    placeholder?: string
    running?: boolean
  }>(),
  {
    placeholder: "do what you want ...",
    running: false,
  },
)

/** 与外部 prompt 双向绑定：输入/增强结果写回外部，外部草稿恢复时同步进编辑器 */
const prompt = defineModel<string>("prompt", { required: true })

const emit = defineEmits<{
  /** 裸 Enter：是否真正发送由父组件守卫 */
  submit: []
}>()

const editor = ref<HTMLElement | null>(null)

const hasText = computed(() => prompt.value.trim().length > 0)

/** 聚焦并把光标移到末尾 */
function focusEnd() {
  const el = editor.value
  if (!el) return
  el.focus()
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
/** 供父组件（发送/选文件后）重新聚焦编辑器 */
function focus() {
  editor.value?.focus()
}

function syncFromEditor() {
  const el = editor.value
  if (!el) return
  prompt.value = el.innerText
}

// 外部改写 prompt（draft 恢复等）时同步进编辑器。
// 挂载时也同步一次：重挂载且 prompt 初始非空时，保证编辑器显示既有草稿（watch 非 immediate，setup 阶段 editor 尚未挂载）。
function syncFromPrompt() {
  const el = editor.value
  if (!el) return
  if (el.innerText !== prompt.value) {
    const sel = window.getSelection()
    const focused = sel && el.contains(sel.anchorNode)
    el.innerText = prompt.value
    if (focused) focusEnd()
  }
}
watch(prompt, syncFromPrompt)
onMounted(syncFromPrompt)

function onEditorKeydown(e: KeyboardEvent) {
  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
}

/** 点卡空白处聚焦；控件（按钮/输入/编辑器）放行，避免抢走自身交互。 */
function onChatInputMousedown(e: MouseEvent) {
  const el = e.target
  if (!(el instanceof Element)) return
  if (el.closest("button, input, textarea, [contenteditable]")) return
  e.preventDefault()
  focus()
}

defineExpose({ focus })
</script>

<style scoped>
.chat-input {
  position: relative;
}
.attach-tray {
  position: relative;
  z-index: 0;
  height: 0;
  overflow: hidden;
  transition: height var(--duration-fast) var(--ease-smooth);
}
.attach-tray[data-open] {
  height: 68px;
  overflow: visible;
}
.attach-inner {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 0;
  bottom: -8px;
  display: flex;
  align-items: flex-start;
  background: var(--chat-input);
  border: var(--border-width) solid var(--chat-input-ring);
  border-bottom: 0;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}
.chips {
  display: flex;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: var(--spacing-xs);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 10px var(--spacing-sm) 18px;
  overflow-x: auto;
  overflow-y: hidden;
}
.glass-shell {
  position: relative;
  z-index: 10;
  isolation: isolate;
}
.glass-shell::before {
  pointer-events: none;
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: var(--radius-xl);
  background: color-mix(in srgb, var(--chat-input) var(--glass-opacity), transparent);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturation));
  content: "";
}
.glass-host {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: transparent;
  border: var(--border-width) solid var(--chat-input-ring);
  border-radius: var(--radius-xl);
}
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .glass-shell::before {
    background: var(--chat-input);
  }
}
@media (prefers-reduced-transparency: reduce) {
  .glass-shell::before {
    background: var(--chat-input);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

.editor-wrap {
  padding: 14px var(--spacing-md) 48px;
}
.field {
  position: relative;
  width: 100%;
  margin: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: 1.5;
  min-height: 44px;
  max-height: 160px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
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
  color: var(--ink-faint);
  pointer-events: none;
}

.row {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  min-height: 44px;
  padding: 6px 10px var(--spacing-xs) 10px;
}
.left {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}

@media (prefers-reduced-motion: reduce) {
  .attach-tray,
  .glass-host {
    transition: none;
  }
}
</style>
