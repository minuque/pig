<template>
  <EditorContent v-if="editor" class="editor" :editor="editor" />

  <ReplyCommentPopover
    :open="reply.replyCommentOpen.value"
    :reference="reply.activeEdit.value?.reference ?? null"
    :anchor="reply.activeEdit.value?.anchor ?? null"
    :side="reply.activeEdit.value?.side ?? 'top'"
    :align="reply.activeEdit.value?.align ?? 'start'"
    @save="reply.save"
    @auto-save="reply.autoSave"
    @save-and-send="reply.saveAndSend"
    @cancel="reply.cancel"
    @dismiss="reply.dismiss"
  />
</template>

<script setup lang="ts">
import { watch } from "vue"
import { EditorContent, useEditor } from "@tiptap/vue-3"
import ReplyCommentPopover from "@features/composer/components/ReplyCommentPopover.vue"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import { useReplyComment } from "@features/composer/hooks/use-reply-comment.js"
import { insertComposerChip, replaceComposerRange } from "@features/composer/lib/editor/chips.js"
import {
  copySelection,
  handlePromptPaste,
  insertMarkdownAtEnd,
} from "@features/composer/lib/editor/clipboard.js"
import { buildDocJson } from "@features/composer/lib/editor/doc-parse.js"
import { markdownOffsetAt } from "@features/composer/lib/editor/doc-offset.js"
import { serializeEditorDoc } from "@features/composer/lib/editor/doc-serialize.js"
import { createComposerExtensions } from "@features/composer/lib/editor/extensions.js"
import {
  handleEnter,
  handleTab,
  selectMarkdownOffset,
  stepCaretOnArrow,
} from "@features/composer/lib/editor/keys.js"
import { isInCodeContext } from "@features/composer/lib/editor/markdown-source.js"
import { wrapSelectionOnInput } from "@features/composer/lib/editor/surround.js"
import type { ChipInsert, ComposerCaret } from "@features/composer/type.js"

const props = defineProps<{
  modelValue: string
  ariaPlaceholder?: string | undefined
  ariaControls?: string | undefined
  ariaActivedescendant?: string | undefined
  disabled?: boolean | undefined
}>()
const emit = defineEmits<{
  "update:modelValue": [value: string]
  caret: [payload: ComposerCaret]
  keydown: [event: KeyboardEvent]
  pasteFiles: [files: File[]]
  composing: [value: boolean]
  blur: []
  openFile: [path: string]
  jumpReply: [target: { sessionId: string; entryId: string }]
  submit: []
}>()
let syncedText = props.modelValue
let shiftHeld = false
const editor = useEditor({
  content: buildDocJson(props.modelValue),
  editable: props.disabled !== true,
  extensions: createComposerExtensions({ onOpenFile: (path) => emit("openFile", path) }),
  editorProps: {
    attributes: viewAttributes(),
    handleKeyDown: (_view, event) => onFieldKeydown(event),
    handleTextInput: (view, from, to, text) => wrapSelectionOnInput(view, from, to, text),
    handlePaste: (_view, event) => onPaste(event),
    handleDOMEvents: {
      keyup: (_view, event) => {
        shiftHeld = event.shiftKey
        return false
      },
      copy: (view, event) => copySelection(view, event, false),
      cut: (view, event) => copySelection(view, event, true),
      compositionstart: () => {
        emit("composing", true)
        return false
      },
      compositionend: () => {
        emit("composing", false)
        return false
      },
    },
  },
  onTransaction: ({ transaction }) => sync(transaction.docChanged),
  onBlur: () => emit("blur"),
})
const reply = useReplyComment({
  editor,
  onOpenFile: (path) => emit("openFile", path),
  onJumpReply: (target) => emit("jumpReply", target),
  onSubmit: () => emit("submit"),
})

watch(viewAttributes, (attributes) => {
  const instance = editor.value

  if (!instance || instance.isDestroyed) return
  instance.view.setProps({ attributes })
})

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(disabled !== true, false)

    if (disabled) reply.dismiss()
  },
)

watch(
  () => props.modelValue,
  (next) => {
    const instance = editor.value

    if (next === syncedText || !instance || instance.isDestroyed) return
    syncedText = next
    instance.commands.setContent(buildDocJson(next), { emitUpdate: false })

    if (instance.isFocused) selectMarkdownOffset(instance, next, next.length)
    sync(true)
  },
)

function viewAttributes(): Record<string, string> {
  return {
    class: "field",
    role: "textbox",
    "aria-multiline": "true",
    "aria-label": "Prompt",
    "aria-autocomplete": "list",
    ...(props.ariaPlaceholder ? { "aria-placeholder": props.ariaPlaceholder } : {}),
    ...(props.ariaControls ? { "aria-controls": props.ariaControls } : {}),
    ...(props.ariaActivedescendant ? { "aria-activedescendant": props.ariaActivedescendant } : {}),
  }
}

function sync(edited: boolean) {
  const instance = editor.value

  if (!instance) return
  const { doc, selection } = instance.state

  if (edited) {
    reply.syncActive()
    const text = serializeEditorDoc(doc).value

    if (text !== syncedText) {
      syncedText = text
      emit("update:modelValue", text)
    }
  }

  emit("caret", {
    offset: markdownOffsetAt(doc, selection.from),
    edited,
    inCode: isInCodeContext(instance.state),
  })
}

function onFieldKeydown(event: KeyboardEvent): boolean {
  shiftHeld = event.shiftKey
  const instance = editor.value
  const menuActive = Boolean(props.ariaControls && props.ariaActivedescendant)

  if (instance && !menuActive) {
    if (stepCaretOnArrow(instance.view, event)) return true

    if (handleEnter(instance, event) || handleTab(instance, event)) return true
  }

  emit("keydown", event)
  return event.defaultPrevented
}

function onPaste(event: ClipboardEvent): boolean {
  const instance = editor.value

  if (!instance) return false
  return handlePromptPaste(
    instance,
    event,
    shiftHeld,
    (files) => emit("pasteFiles", files),
    clipboardFiles,
  )
}

function focus() {
  editor.value?.commands.focus("end")
}

function blur() {
  editor.value?.commands.blur()
}

function isAtStart(): boolean {
  const selection = editor.value?.state.selection
  return !!selection?.empty && selection.from <= 1
}

function isAtEnd(): boolean {
  const state = editor.value?.state

  if (!state) return true
  return state.selection.empty && state.selection.to >= state.doc.content.size - 1
}

function insertChip(chip: ChipInsert) {
  if (editor.value) insertComposerChip(editor.value, chip)
}

function replaceRange(start: number, triggerLength: number, text: string) {
  if (editor.value) replaceComposerRange(editor.value, start, triggerLength, text)
}

function insertMarkdown(text: string) {
  if (editor.value && !editor.value.isDestroyed) insertMarkdownAtEnd(editor.value, text)
}

defineExpose({
  focus,
  blur,
  insertChip,
  insertMarkdown,
  insertReply: reply.insertReply,
  replyCommentOpen: reply.replyCommentOpen,
  replaceRange,
  isAtStart,
  isAtEnd,
})
</script>

<style scoped>
.editor :deep(.field) {
  display: block;
  width: 100%;
  min-height: 2lh;
  max-height: var(--composer-field-max);
  outline: 0;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-body);
  line-height: 1.625;
  overscroll-behavior: contain;
  overflow-y: auto;
  word-break: break-word;
  cursor: text;
}

.editor :deep(.field p) {
  margin: 0;
}

.editor :deep(.field) > * + * {
  margin-top: var(--space-xs);
}

.editor :deep(.field h1),
.editor :deep(.field h2),
.editor :deep(.field h3),
.editor :deep(.field h4),
.editor :deep(.field h5),
.editor :deep(.field h6) {
  color: var(--fg);
  font-size: inherit;
  line-height: 1.35;
  font-weight: var(--font-weight-semibold);
}

.editor :deep(.field h1) {
  font-size: 1.25em;
}

.editor :deep(.field h2) {
  font-size: 1.15em;
}

.editor :deep(.field h4),
.editor :deep(.field h5),
.editor :deep(.field h6) {
  font-weight: var(--font-weight-medium);
}

.editor :deep(.field h6) {
  color: var(--fg-secondary);
}

.editor :deep(.field strong) {
  font-weight: var(--font-weight-semibold);
}

.editor :deep(.field em) {
  font-style: italic;
}

.editor :deep(.field s) {
  text-decoration: line-through;
}

.editor :deep(.field code) {
  padding: 0.1em 0.35em;
  border-radius: calc(var(--radius-control) / 2);
  background: var(--bg-muted);
  color: inherit;
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.editor :deep(.field pre) {
  overflow-x: auto;
  padding: var(--space-xs);
  border-radius: var(--radius-card);
  background: var(--bg-surface);
  font-family: var(--font-mono);
  font-size: var(--text-code);
  line-height: 1.5;
  white-space: pre;
}

.editor :deep(.field pre code) {
  padding: 0;
  background: none;
  font-family: inherit;
  font-size: inherit;
}

.editor :deep(.field blockquote) {
  padding-inline-start: var(--space-xs);
  border-inline-start: var(--quote-border-width) solid var(--border-subtle);
  color: var(--fg-secondary);
}

.editor :deep(.field ul) {
  padding-inline-start: var(--space-lg);
  list-style-type: disc;
}

.editor :deep(.field ul ul) {
  list-style-type: circle;
}

.editor :deep(.field ul ul ul) {
  list-style-type: square;
}

.editor :deep(.field ol) {
  padding-inline-start: max(var(--space-lg), 3ch);
  list-style-type: decimal;
}

.editor :deep(.field ol:has(> li[data-marker-width="3"])) {
  padding-inline-start: max(var(--space-lg), 4ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="4"])) {
  padding-inline-start: max(var(--space-lg), 5ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="5"])) {
  padding-inline-start: max(var(--space-lg), 6ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="6"])) {
  padding-inline-start: max(var(--space-lg), 7ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="7"])) {
  padding-inline-start: max(var(--space-lg), 8ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="8"])) {
  padding-inline-start: max(var(--space-lg), 9ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="9"])) {
  padding-inline-start: max(var(--space-lg), 10ch);
}

.editor :deep(.field ol:has(> li[data-marker-width="10"])) {
  padding-inline-start: max(var(--space-lg), 11ch);
}

.editor :deep(.field ol > li::marker) {
  font-variant-numeric: tabular-nums;
}

.editor :deep(.field ol > li[data-marker]::marker) {
  content: attr(data-marker) " ";
}

.editor :deep(.field li::marker) {
  color: var(--fg-muted);
}

.editor :deep(.field li) > :is(ul, ol) {
  margin-block: 0;
}

.editor :deep(.field hr) {
  border: 0;
  border-top: var(--border-width) solid var(--border-subtle);
  margin-block: var(--space-xs);
}

.editor :deep(.field ul[data-type="taskList"]),
.editor :deep(.field ul[data-type="taskList"] ul[data-type="taskList"]) {
  list-style: none;
}

.editor :deep(.field ul[data-type="taskList"]) {
  padding-inline-start: 0;
}

.editor :deep(.field ul[data-type="taskList"] ul[data-type="taskList"]) {
  padding-inline-start: var(--space-lg);
}

.editor :deep(.field li[data-checked]) {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2xs);
}

.editor :deep(.field li[data-checked] > label) {
  display: flex;
  align-items: center;
  flex: none;
  block-size: 1lh;
  user-select: none;
  cursor: pointer;
}

.editor :deep(.field li[data-checked] > div) {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.editor :deep(.field li[data-checked] input[type="checkbox"]) {
  display: block;
  margin: 0;
  inline-size: 0.95rem;
  block-size: 0.95rem;
  accent-color: var(--accent-solid);
  cursor: pointer;
}

.editor :deep(.field .is-source-marker) {
  color: var(--fg-muted);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-decoration: none;
}

.editor :deep(.field .is-source-marker-hidden) {
  display: none;
}

.editor :deep(.chip-node) {
  display: inline;
}

.editor :deep(.is-chip-selected.inline-chip),
.editor :deep(.is-chip-selected .inline-chip) {
  background: var(--bg-selected);
  color: var(--accent-text);
}

.editor :deep(.field)::selection,
.editor :deep(.field) ::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
