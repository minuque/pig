<template>
  <div class="chat-input" @mousedown="onChatInputMousedown">
    <div class="attach-tray" :data-open="$slots.chips ? '' : undefined">
      <div class="attach-inner">
        <div class="chips">
          <slot name="chips" />
        </div>
      </div>
    </div>
    <div class="glass-shell">
      <div class="glass-host">
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

<script lang="ts">
/** 键盘守卫：仅裸 Enter 触发提交；Shift+Enter 换行、IME 组合期间一律放行。 */
export function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}
</script>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    ariaLabel?: string
  }>(),
  {
    placeholder: "do what you want ...",
    ariaLabel: "do what you want ...",
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
  gap: 8px;
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px 18px;
  overflow-x: auto;
  overflow-y: hidden;
}
.glass-shell {
  position: relative;
  z-index: 10;
}
.glass-host {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  background: var(--chat-input);
  border: var(--border-width) solid var(--chat-input-ring);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}

.editor-wrap {
  padding: 14px 16px 48px;
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
.field:focus-visible {
  outline: 0;
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
  gap: 8px;
  min-height: 44px;
  padding: 6px 10px 8px 10px;
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
