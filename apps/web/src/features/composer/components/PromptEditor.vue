<template>
  <div
    ref="container"
    class="composer motion-composer"
    :data-expanded="expanded"
    :data-multiline="multiline"
    @mousedown="onComposerMousedown"
  >
    <div class="glass-shell">
      <div class="glass-host">
        <div class="editor-wrap">
          <textarea
            ref="editor"
            v-model="prompt"
            class="field"
            :placeholder="placeholder"
            :readonly="readonly"
            aria-label="Prompt"
            :aria-readonly="readonly"
            rows="1"
            @keydown="onEditorKeydown"
          ></textarea>
        </div>
        <div class="left">
          <slot name="left" />
        </div>
        <div class="right">
          <slot name="right" :expanded="expanded" />
        </div>
      </div>
    </div>
    <div v-if="$slots.meta" class="footer">
      <slot name="meta" />
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
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    readonly?: boolean
  }>(),
  {
    placeholder: "do what you want ...",
    readonly: false,
  },
)

const prompt = defineModel<string>("prompt", { required: true })

const emit = defineEmits<{
  submit: []
}>()

const editor = ref<HTMLTextAreaElement | null>(null)
const container = ref<HTMLElement | null>(null)

const hasText = computed(() => prompt.value.length > 0)
const expanded = computed(() => prompt.value.includes("\n"))
const multiline = shallowRef(false)

let widthObserver: ResizeObserver | undefined
let lastWidth = 0

function fitEditor() {
  const el = editor.value
  if (!el) return
  el.style.height = "auto"
  const next = el.scrollHeight
  el.style.height = `${next}px`
  const line = Number.parseFloat(getComputedStyle(el).lineHeight) || 22
  multiline.value = next > line + 2 || el.value.includes("\n")
}

watch(
  prompt,
  () => {
    fitEditor()
    if (!props.readonly) return
    const el = editor.value
    if (el) el.scrollTop = el.scrollHeight
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
      fitEditor()
    })
    widthObserver.observe(el)
    fitEditor()
  },
  { flush: "post" },
)

onBeforeUnmount(() => widthObserver?.disconnect())

function focus() {
  const el = editor.value
  if (!el) return
  el.focus()
  el.selectionStart = el.selectionEnd = el.value.length
}

function onEditorKeydown(e: KeyboardEvent) {
  if (props.readonly) return
  if (e.key === "Escape" && !e.isComposing && !hasText.value) editor.value?.blur()
  if (shouldSubmitOnKeydown(e)) {
    e.preventDefault()
    emit("submit")
  }
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
}

.glass-shell {
  position: relative;
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-soft);
}
.composer[data-expanded="true"] .glass-shell,
.composer[data-multiline="true"] .glass-shell {
  border-radius: var(--radius-xl);
}

.glass-host {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: "editor left right";
  align-items: center;
  column-gap: var(--spacing-xxs);
  padding-block: var(--spacing-xs);
  padding-inline: var(--spacing-sm);
  overflow: hidden;
  background: var(--composer-bg);
  border: var(--border-width) solid var(--composer-ring);
  border-radius: var(--radius-full);
}
.composer[data-expanded="true"] .glass-host {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "editor editor"
    "left right";
  align-items: end;
  row-gap: var(--spacing-xxs);
  padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-xs);
  border-radius: var(--radius-xl);
}
.composer[data-multiline="true"] .glass-host {
  align-items: end;
  border-radius: var(--radius-xl);
}

.footer {
  min-width: 0;
  padding-inline: var(--spacing-xxs);
}

.left,
.right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
}
.left {
  grid-area: left;
  min-width: 0;
}
.right {
  grid-area: right;
}

.editor-wrap {
  grid-area: editor;
  min-width: 0;
  padding-inline: var(--spacing-xxs);
}

.field {
  display: block;
  width: 100%;
  margin: 0;
  padding-block: calc((var(--size-icon-button) - 1.5em) / 2);
  padding-inline: 0;
  border: 0;
  outline: 0;
  resize: none;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: var(--text-body-md);
  line-height: 1.5;
  min-height: var(--size-icon-button);
  max-height: 160px;
  overscroll-behavior: contain;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
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
