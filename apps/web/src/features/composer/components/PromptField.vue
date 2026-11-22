<template>
  <EditorContent v-if="editor" class="editor" :editor="editor" />
</template>

<script setup lang="ts">
import { watch } from "vue"
import type { Editor } from "@tiptap/core"
import { EditorContent, useEditor } from "@tiptap/vue-3"
import { closeHistory } from "@tiptap/pm/history"
import { TextSelection } from "@tiptap/pm/state"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import { createComposerExtensions } from "@features/composer/lib/tiptap-chips.js"
import { parsePromptToDoc, serializeDocToPrompt } from "@features/composer/lib/tiptap-doc.js"
import { positionAtOffset, textOffsetAt } from "@features/composer/lib/tiptap-offset.js"
import type { ChipInsert, ComposerCaret } from "@features/composer/type.js"

const PASTE_MAX_LINES = 300
const PASTE_MAX_BYTES = 12_288
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
}>()
let syncedText = props.modelValue
let shiftHeld = false
let pasteSeq = 0
const editor = useEditor({
  content: parsePromptToDoc(props.modelValue),
  editable: props.disabled !== true,
  extensions: createComposerExtensions({ onOpenFile: (path) => emit("openFile", path) }),
  editorProps: {
    attributes: viewAttributes(),
    handleKeyDown: (_view, event) => onFieldKeydown(event),
    handlePaste: (_view, event) => onPaste(event),
    handleDOMEvents: {
      keyup: (_view, event) => {
        shiftHeld = event.shiftKey
        return false
      },
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

watch(viewAttributes, (attributes) => {
  const instance = editor.value

  if (!instance || instance.isDestroyed) return
  instance.view.setProps({ attributes })
})

watch(
  () => props.disabled,
  (disabled) => editor.value?.setEditable(disabled !== true, false),
)

watch(
  () => props.modelValue,
  (next) => {
    const instance = editor.value

    if (next === syncedText || !instance || instance.isDestroyed) return
    syncedText = next
    instance.commands.setContent(parsePromptToDoc(next), { emitUpdate: false })

    if (instance.isFocused) {
      instance.commands.setTextSelection(Math.max(1, instance.state.doc.content.size - 1))
    }

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
  const text = serializeDocToPrompt(instance.getJSON())

  if (text !== syncedText) {
    syncedText = text
    emit("update:modelValue", text)
  }

  const { doc, selection } = instance.state

  emit("caret", { offset: textOffsetAt(doc, selection.from), edited })
}

function onFieldKeydown(event: KeyboardEvent): boolean {
  shiftHeld = event.shiftKey
  emit("keydown", event)
  return event.defaultPrevented
}

function onPaste(event: ClipboardEvent): boolean {
  const files = clipboardFiles(event.clipboardData)

  if (files.length) {
    emit("pasteFiles", files)
    return true
  }

  if (shiftHeld) return false
  const text = event.clipboardData?.getData("text/plain") ?? ""
  const oversize =
    text.length > 0 &&
    (text.split("\n").length > PASTE_MAX_LINES ||
      new TextEncoder().encode(text).length > PASTE_MAX_BYTES)

  if (!oversize) return false
  pasteSeq += 1
  emit("pasteFiles", [new File([text], `pasted-${pasteSeq}.txt`, { type: "text/plain" })])
  return true
}

function chipNode(instance: Editor, chip: ChipInsert) {
  const { nodes } = instance.schema

  if (chip.kind === "file") {
    return nodes["fileMention"]?.create({ path: chip.path ?? chip.label, label: chip.label })
  }

  return nodes["commandChip"]?.create({
    name: chip.label,
    kind: chip.kind === "skill" ? "skill" : null,
  })
}

function focus() {
  editor.value?.commands.focus("end")
}

function blur() {
  editor.value?.commands.blur()
}

function isAtStart(): boolean {
  const { state } = editor.value ?? {}
  const selection = state?.selection
  return !!selection?.empty && selection.from <= 1
}

function isAtEnd(): boolean {
  const { state } = editor.value ?? {}
  const selection = state?.selection

  if (!state || !selection) return true
  return selection.empty && selection.to >= state.doc.content.size - 1
}

function insertChip(chip: ChipInsert) {
  const instance = editor.value

  if (!instance) return
  const node = chipNode(instance, chip)

  if (!node) return
  const { state } = instance
  const from = positionAtOffset(state.doc, chip.start)
  const to = Math.max(from, positionAtOffset(state.doc, chip.start + chip.triggerLength))
  const tr = closeHistory(state.tr.replaceWith(from, to, [node, instance.schema.text(" ")]))
  const caret = Math.min(from + node.nodeSize + 1, tr.doc.content.size - 1)

  tr.setSelection(TextSelection.create(tr.doc, Math.max(1, caret)))
  instance.view.dispatch(tr)
  instance.view.focus()
}

defineExpose({ focus, blur, insertChip, isAtStart, isAtEnd })
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

.editor :deep(.chip) {
  display: inline-flex;
  align-items: baseline;
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

.editor :deep(.chip[data-file-mention]) {
  cursor: pointer;
}

.editor :deep(.is-chip-selected) {
  background: var(--bg-selected);
  color: var(--accent-text);
}

.editor :deep(.field)::selection,
.editor :deep(.field) ::selection {
  background: Highlight;
  color: HighlightText;
}
</style>
