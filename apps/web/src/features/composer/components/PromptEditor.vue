<template>
  <div class="composer" @mousedown="onComposerMousedown">
    <Transition name="menu-reveal">
      <CommandMenu
        v-if="commandMenu.open.value"
        class="command-menu-float"
        :groups="commandMenu.groups.value"
        :active-id="commandMenu.activeId.value"
        :loading="commandMenu.loading.value"
        :empty-text="commandMenu.emptyText.value"
        :aria-label="commandMenuAriaLabel"
        @select="commandMenu.select"
        @highlight="(id) => (commandMenu.activeId.value = id)"
      />
    </Transition>

    <div class="composer-card">
      <div class="body">
        <div v-if="$slots.attachments" class="attachments">
          <slot name="attachments" />
        </div>

        <div
          ref="editor"
          class="field"
          contenteditable="plaintext-only"
          role="textbox"
          aria-multiline="true"
          aria-label="Prompt"
          :aria-controls="commandMenu.open.value ? 'composer-command-menu' : undefined"
          :aria-activedescendant="commandMenuActiveId"
          aria-autocomplete="list"
          :data-placeholder="placeholder"
          @keydown="onEditorKeydown"
          @paste="onEditorPaste"
          @input="onEditorInput"
          @click="syncCaret"
          @keyup="syncCaret"
          @select="syncCaret"
          @blur="onEditorBlur"
        ></div>
      </div>

      <div class="footer">
        <div class="cluster left">
          <slot name="left" />
        </div>

        <div class="cluster tools">
          <slot name="tools" />
        </div>

        <div class="cluster right">
          <slot name="right" />
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
import { computed, onBeforeUpdate, ref, useTemplateRef, watch } from "vue"
import { clipboardFiles } from "@features/composer/hooks/use-composer-attachments.js"
import { useCommandMenu, type ChipInsert } from "@features/composer/hooks/use-command-menu.js"
import CommandMenu from "@features/composer/components/CommandMenu.vue"
import { promptPlaceholder } from "@features/composer/index.js"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    cwd?: string | undefined
  }>(),
  {
    placeholder: promptPlaceholder(),
    cwd: undefined,
  },
)
const prompt = defineModel<string>("prompt", { required: true })
const emit = defineEmits<{
  submit: []
  pasteFiles: [files: File[]]
}>()
const editor = useTemplateRef("editor")
const hasText = computed(() => prompt.value.length > 0)
const caret = ref(0)
const commandMenu = useCommandMenu(prompt, caret, () => props.cwd, insertChip)

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
  const next = document.createRange()
  next.setStartAfter(space)
  next.collapse(true)
  sel?.removeAllRanges()
  sel?.addRange(next)
  prompt.value = serialize()
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

const commandMenuAriaLabel = computed(() => "输入卡命令")
const commandMenuActiveId = computed(() => {
  const id = commandMenu.activeId.value
  return id ? `composer-command-menu-row-${encodeURIComponent(id)}` : undefined
})

function renderPrompt(text: string) {
  const el = editor.value

  if (!el) return
  el.textContent = text
}

let applyingPrompt = false

watch(
  prompt,
  () => {
    applyingPrompt = true
  },
  { flush: "pre" },
)

watch(
  prompt,
  (next) => {
    if (editor.value && serialize() !== next) renderPrompt(next)
    applyingPrompt = false
  },
  { flush: "post" },
)

onBeforeUpdate(() => {
  if (applyingPrompt) return
  const el = editor.value

  if (!el || document.activeElement !== el) return
  const current = serialize()

  if (current !== prompt.value) prompt.value = current
})

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

function onEditorKeydown(e: KeyboardEvent) {
  syncCaret()

  if (commandMenu.onKeydown(e)) return

  if (e.key === "Escape" && !e.isComposing && !hasText.value) editor.value?.blur()

  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
}

function onEditorInput() {
  syncCaret()
  prompt.value = serialize()
}

function domCaretOffset(): number {
  const el = editor.value

  if (!el) return caret.value
  const sel = window.getSelection()

  if (!sel || !sel.rangeCount || !el.contains(sel.anchorNode)) return caret.value
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

function syncCaret() {
  caret.value = domCaretOffset()
}

function onEditorBlur() {
  commandMenu.close()
}

function onEditorPaste(e: ClipboardEvent) {
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

function onComposerMousedown(e: MouseEvent) {
  const el = e.target

  if (!(el instanceof Element)) return

  if (el.closest("button, input, textarea, a, [role='menuitem']")) return
  e.preventDefault()
  focus()
}

defineExpose({ focus })
</script>

<style scoped>
.composer {
  position: relative;
  width: 100%;
  margin-inline: auto;
}

.command-menu-float {
  margin-bottom: var(--space-2xs);
}

.composer-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--composer-radius);
  background: var(--composer-bg);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border),
    var(--composer-inset),
    var(--composer-shadow);
  corner-shape: var(--composer-corner-shape);
  transition:
    background-color var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}

.composer-card:hover {
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-inset),
    var(--composer-shadow);
}

.composer-card:has(.field:focus) {
  background: var(--composer-focus-bg);
  box-shadow:
    inset 0 0 0 var(--border-width) var(--composer-border-hover),
    var(--composer-focus-shadow);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-width: 0;
  padding: var(--space-md) var(--space-md) var(--space-xs);
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
  padding: 0 var(--space-xs) var(--space-xs);
}

.cluster {
  display: flex;
  align-items: center;
  gap: var(--space-2xs);
  flex: none;
  min-width: 0;
}

.cluster.tools {
  flex: 1 1 auto;
  justify-content: flex-end;
  margin-inline-end: var(--space-2xs);
}

.cluster.right {
  gap: var(--space-xs);
}

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

.field:empty::before {
  content: attr(data-placeholder);
  color: var(--fg-muted);
  pointer-events: none;
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

@media (prefers-reduced-motion: reduce) {
  .composer-card {
    transition: none;
  }
}
</style>
