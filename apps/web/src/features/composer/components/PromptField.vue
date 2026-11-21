<template>
  <div
    ref="editor"
    class="field"
    contenteditable="plaintext-only"
    role="textbox"
    aria-multiline="true"
    aria-label="Prompt"
    :aria-controls="ariaControls"
    :aria-activedescendant="ariaActivedescendant"
    aria-autocomplete="list"
    :aria-placeholder="ariaPlaceholder"
    @keydown="onKeydown"
    @paste="onPaste"
    @input="onInput"
    @compositionstart="emit('composing', true)"
    @compositionend="onCompositionEnd"
    @click="emitCaret"
    @keyup="emitCaret"
    @select="emitCaret"
    @blur="emit('blur')"
  ></div>
</template>

<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import type { ChipInsert } from "@features/composer/hooks/use-command-menu.js"

const props = defineProps<{
  modelValue: string
  ariaPlaceholder?: string | undefined
  ariaControls?: string | undefined
  ariaActivedescendant?: string | undefined
}>()
const emit = defineEmits<{
  "update:modelValue": [value: string]
  caret: [offset: number]
  keydown: [event: KeyboardEvent]
  pasteFiles: [files: File[]]
  composing: [value: boolean]
  blur: []
}>()
const editor = useTemplateRef("editor")
let lastSynced = ""
let lastCaret = 0

function writeText(text: string) {
  const el = editor.value

  if (!el) return
  el.textContent = text
}

onMounted(() => {
  if (props.modelValue && serialize() !== props.modelValue) writeText(props.modelValue)
  lastSynced = serialize()
})

watch(
  () => props.modelValue,
  (next) => {
    if (next === lastSynced) return

    if (editor.value && serialize() !== next) writeText(next)
    lastSynced = next
  },
)

function insertChip(chip: ChipInsert) {
  const el = editor.value

  if (!el) return
  const at = domPositionAt(el, chip.start)

  if (!at) return
  const range = document.createRange()
  range.setStart(at.node, at.offset)
  const end = domPositionAt(el, chip.start + chip.triggerLength)

  if (end) range.setEnd(end.node, end.offset)
  range.deleteContents()
  const node = buildChip(chip)
  range.insertNode(node)
  const space = document.createTextNode(" ")
  node.after(space)
  const sel = window.getSelection()
  const nextRange = document.createRange()
  nextRange.setStartAfter(space)
  nextRange.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(nextRange)
  const next = serialize()
  lastSynced = next
  emitCaret()

  if (next !== props.modelValue) emit("update:modelValue", next)
}

function buildChip(chip: ChipInsert): HTMLElement {
  const el = document.createElement("span")
  el.className = "chip"
  el.dataset.chipKind = chip.kind
  el.dataset.chipToken = chip.token.trimEnd()
  el.contentEditable = "false"
  el.innerHTML = `${chipIconSvg(chip.kind)}<span class="chip-label"></span>`
  el.querySelector(".chip-label")!.textContent = chip.label
  return el
}

const CHIP_ICONS: Record<ChipInsert["kind"], string> = {
  skill:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
  builtin:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"/><path d="M12 19h8"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>',
}

function chipIconSvg(kind: ChipInsert["kind"]): string {
  return `<span class="chip-icon" aria-hidden="true">${CHIP_ICONS[kind]}</span>`
}

function focus() {
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

function blur() {
  editor.value?.blur()
}

function onKeydown(e: KeyboardEvent) {
  emitCaret()
  emit("keydown", e)
}

function onInput() {
  const next = serialize()
  lastSynced = next
  emitCaret()

  if (next !== props.modelValue) emit("update:modelValue", next)
}

function onCompositionEnd() {
  emit("composing", false)
  onInput()
}

function domCaretOffset(): number {
  const el = editor.value

  if (!el) return lastCaret
  const sel = window.getSelection()

  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return lastCaret
  let offset = 0
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  const anchor = sel.anchorNode!
  const anchorOffset = sel.anchorOffset
  let node: Node | null = walker.currentNode

  while (node && node !== anchor) {
    if (node.nodeType === Node.TEXT_NODE) {
      offset += node.textContent?.length ?? 0
    } else if (node instanceof HTMLElement && node.dataset.chipToken) {
      offset += node.dataset.chipToken.length
    }

    node = walker.nextNode()
  }

  if (anchor.nodeType === Node.TEXT_NODE) return offset + anchorOffset
  return offset
}

function serialize(): string {
  const el = editor.value

  if (!el) return ""
  let text = ""

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node instanceof HTMLElement) {
      if (node.dataset.chipToken) text += node.dataset.chipToken
      else if (node.tagName === "BR") text += "\n"
      else if (node.tagName === "DIV") text += `\n${node.textContent ?? ""}`
      else text += node.textContent
    }
  }

  return text.replace(/^\n/, "")
}

function emitCaret() {
  lastCaret = domCaretOffset()
  emit("caret", lastCaret)
}

function onPaste(e: ClipboardEvent) {
  const files = clipboardFiles(e.clipboardData)

  if (!files.length) return
  e.preventDefault()
  emit("pasteFiles", files)
}

function domPositionAt(root: HTMLElement, offset: number): { node: Node; offset: number } | null {
  let remaining = offset
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node: Node | null = walker.nextNode()
  let lastText: Node | null = null

  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent?.length ?? 0
      lastText = node

      if (remaining <= len) return { node, offset: remaining }
      remaining -= len
    } else if (node instanceof HTMLElement && node.dataset.chipToken) {
      const len = node.dataset.chipToken.length
      const index = Array.prototype.indexOf.call(node.parentNode?.childNodes ?? [], node)

      if (remaining <= len) {
        return { node: node.parentNode!, offset: index + (remaining > len / 2 ? 1 : 0) }
      }

      remaining -= len
    }

    node = walker.nextNode()
  }

  if (lastText) return { node: lastText, offset: lastText.textContent?.length ?? 0 }
  return { node: root, offset: 0 }
}

defineExpose({ focus, blur, insertChip })
</script>

<style scoped>
.field {
  display: block;
  width: 100%;
  min-height: 2lh;
  max-height: var(--composer-field-max);
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-body);
  line-height: 1.625;
  overscroll-behavior: contain;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  cursor: text;
}

.field :deep(.chip) {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  max-width: 100%;
  margin-inline: 1px;
  padding: 1px var(--space-2xs);
  border-radius: calc(var(--radius-control) / 2);
  background: var(--info-subtle);
  color: var(--info-text);
  font-weight: var(--font-weight-medium);
  font-size: inherit;
  line-height: inherit;
  vertical-align: baseline;
  user-select: none;
  cursor: default;
}

.field :deep(.chip-icon) {
  display: inline-flex;
  align-self: center;
  flex: none;
}

.field :deep(.chip-icon svg) {
  width: 0.95em;
  height: 0.95em;
}

.field :deep(.chip-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field ::selection,
.field::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
