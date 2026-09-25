<template>
  <div ref="container" class="composer" @mousedown="onComposerMousedown">
    <div ref="card" class="composer-card glass" :class="expanded ? 'is-expanded' : 'is-compact'">
      <div v-if="$slots.attachments" class="attachments">
        <slot name="attachments" />
      </div>

      <div class="main">
        <div ref="editorWrap" class="editor-wrap">
          <textarea
            ref="editor"
            v-model="prompt"
            class="field"
            :placeholder="placeholder"
            aria-label="Prompt"
            rows="1"
            @keydown="onEditorKeydown"
            @keyup="onEditorCaret"
            @click.passive="onEditorCaret"
            @paste="onEditorPaste"
          ></textarea>
        </div>

        <div class="action-row">
          <div class="cluster left">
            <slot name="left" />
          </div>

          <div class="cluster right">
            <slot name="right" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
export function shouldSubmitOnKeydown(e: {
  key: string
  shiftKey: boolean
  isComposing: boolean
}): boolean {
  return e.key === "Enter" && !e.shiftKey && !e.isComposing
}
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import { composerFlip, FLIP_MS, RESIZE_SETTLE_MS } from "@features/composer/lib/composer-flip.js"
import { PROMPT_PLACEHOLDER } from "@features/composer/index.js"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    /** 外层宽度手柄拖拽中：此期间不折叠。 */
    resizing?: boolean
  }>(),
  {
    placeholder: PROMPT_PLACEHOLDER,
    resizing: false,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  "paste-files": [files: File[]]
  /** 原始 keydown，先发给父级；父级处理补全后 preventDefault，内置提交逻辑跳过。 */
  "editor-keydown": [e: KeyboardEvent]
  /** 光标位置变化（输入/方向键/点击），父级据此评估 @ / 触发词。 */
  caret: [position: number]
}>()
const editor = ref<HTMLTextAreaElement | null>(null)
const editorWrap = ref<HTMLElement | null>(null)
const container = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const expanded = ref(true)
const hasText = computed(() => prompt.value.length > 0)
let widthObserver: ResizeObserver | undefined
let lastWidth = 0
/** 紧凑态实测容量与当时容器宽度；展开态用宽度差平移，绝不用展开态测量值回灌。 */
let lastCompactCapacity = 0
let lastCompactContainerWidth = 0
let firstFlip = true
let measureCtx: CanvasRenderingContext2D | undefined
const internalResizing = ref(false)
let resizeTimer: ReturnType<typeof setTimeout> | undefined
const resizing = computed(() => props.resizing || internalResizing.value)

function fitEditor() {
  const el = editor.value

  if (!el) return
  el.style.height = "auto"
  el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 240)}px`
}

function measureText(text: string) {
  const el = editor.value

  if (!el) return 0

  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d") ?? undefined

  if (!measureCtx) return text.length * 8
  const style = getComputedStyle(el)

  measureCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
  return measureCtx.measureText(text).width
}

function currentCapacity() {
  const wrap = editorWrap.value
  const containerEl = container.value

  if (!wrap || !containerEl) return 0

  if (!expanded.value) {
    lastCompactCapacity = wrap.clientWidth
    lastCompactContainerWidth = containerEl.clientWidth
  }

  return Math.max(0, lastCompactCapacity + (containerEl.clientWidth - lastCompactContainerWidth))
}

function evaluate() {
  const text = prompt.value
  const hasNewline = text.includes("\n")
  const textWidth = hasNewline ? 0 : measureText(text)
  const next = composerFlip({
    hasNewline,
    textWidth,
    capacity: currentCapacity(),
    expanded: expanded.value,
    resizing: resizing.value,
  })

  flipMode(next)
}

/** 底锚形变：胶囊底边不动，高度从旧值过渡到新值。 */
function flipMode(next: boolean) {
  if (next === expanded.value) return
  const cardEl = card.value
  const from = cardEl?.offsetHeight ?? 0
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches

  if (firstFlip || !cardEl || reduce) {
    firstFlip = false
    expanded.value = next

    if (!next) clearFieldHeight()
    else void nextTick().then(fitEditor)
    return
  }

  expanded.value = next

  if (!next) clearFieldHeight()

  void nextTick().then(() => {
    if (next) fitEditor()
    requestAnimationFrame(() => {
      const to = cardEl.offsetHeight

      if (to <= 0 || Math.abs(from - to) < 1) return
      cardEl.style.height = `${from}px`
      void cardEl.offsetHeight
      cardEl.style.height = `${to}px`

      const done = (event?: TransitionEvent) => {
        if (event && event.propertyName !== "height") return
        cardEl.removeEventListener("transitionend", done)

        if (cardEl.style.height) cardEl.style.height = ""
      }

      cardEl.addEventListener("transitionend", done)
      setTimeout(done, FLIP_MS + 40)
    })
  })
}

function clearFieldHeight() {
  const el = editor.value

  if (el) el.style.height = ""
}

watch(
  prompt,
  () => {
    if (expanded.value) fitEditor()
    evaluate()
    emit("caret", caretPosition())
  },
  { flush: "post" },
)

watch(
  container,
  (el) => {
    widthObserver?.disconnect()
    widthObserver = undefined
    lastWidth = 0

    if (!el) return
    widthObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0

      if (width === lastWidth) return
      lastWidth = width
      internalResizing.value = true

      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        internalResizing.value = false
        evaluate()
      }, RESIZE_SETTLE_MS)

      if (expanded.value) fitEditor()
      evaluate()
    })
    widthObserver.observe(el)
    evaluate()
  },
  { flush: "post" },
)

watch(resizing, () => evaluate())

onBeforeUnmount(() => {
  widthObserver?.disconnect()

  if (resizeTimer) clearTimeout(resizeTimer)
})

function caretPosition() {
  return editor.value?.selectionStart ?? prompt.value.length
}

function focus() {
  const el = editor.value

  if (!el) return
  el.focus()
  el.selectionStart = el.selectionEnd = el.value.length
}

/** 补全接受：替换触发词区间并落光标。 */
function replaceRange(start: number, end: number, text: string) {
  const el = editor.value
  const value = prompt.value

  prompt.value = value.slice(0, start) + text + value.slice(end)

  nextTick(() => {
    const pos = start + text.length

    el?.focus()
    el?.setSelectionRange(pos, pos)
  })
}

function onEditorKeydown(e: KeyboardEvent) {
  emit("editor-keydown", e)

  if (e.defaultPrevented) return

  if (e.key === "Escape" && !e.isComposing && !hasText.value) editor.value?.blur()

  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
}

function onEditorCaret(e: Event) {
  emit("caret", e.target === editor.value ? caretPosition() : prompt.value.length)
}

/** 只在真的收到文件时拦截粘贴，纯文本粘贴仍走浏览器默认行为。 */
function onEditorPaste(e: ClipboardEvent) {
  const files = clipboardFiles(e.clipboardData)

  if (!files.length) return
  e.preventDefault()
  emit("paste-files", files)
}

function onComposerMousedown(e: MouseEvent) {
  const el = e.target

  if (!(el instanceof Element)) return

  if (el.closest("button, input, textarea, a, [role='menuitem']")) return
  e.preventDefault()
  focus()
}

defineExpose({ focus, replaceRange })
</script>

<style scoped>
.composer {
  position: relative;
  width: 100%;
  margin-inline: auto;
  border-radius: var(--composer-radius);
  box-shadow: var(--composer-shadow);
}

.composer-card {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  border: var(--border-width) solid var(--surface-border);
  border-radius: inherit;
  transition: height var(--duration-composer-flip) var(--ease-composer-flip);
}

@media (prefers-reduced-motion: reduce) {
  .composer-card {
    transition: none;
  }
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  padding: var(--spacing-md) calc(var(--spacing-md) + var(--border-width)) 0;
}

.main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.is-compact .main {
  height: 49px;
  gap: var(--spacing-xs);
  padding-inline: calc(var(--spacing-sm) + var(--border-width));
}

.is-expanded .main {
  flex-direction: column;
  align-items: stretch;
}

/* 紧凑态动作行拆进主行：回形针在输入框前，模型与发送在后 */
.is-compact .action-row {
  display: contents;
}

.is-compact .cluster.left {
  order: -1;
}

.editor-wrap {
  min-width: 0;
}

.is-compact .editor-wrap {
  flex: 1;
  padding-inline: var(--spacing-xs);
}

.is-expanded .editor-wrap {
  padding: var(--spacing-md) calc(var(--spacing-md) + var(--border-width)) var(--spacing-xxs);
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-xs);
  height: 42px;
  padding: 0 calc(var(--spacing-sm) + var(--border-width));
}

.cluster {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
  min-width: 0;
}

.is-compact .cluster.right {
  /* 模型 chip 在紧凑态最多占胶囊宽 45% */
  max-width: 45%;
}

.field {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: 1.625;
  overscroll-behavior: contain;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.is-compact .field {
  overflow: hidden;
  white-space: nowrap;
}

.is-expanded .field {
  min-height: 56px;
  max-height: 240px;
}

.field::placeholder {
  color: var(--ink-faint);
}

.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
