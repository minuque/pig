<template>
  <div
    ref="container"
    class="composer motion-composer"
    :data-expanded="expanded"
    :data-multiline="multiline"
    @mousedown="onComposerMousedown"
  >
    <div class="attach-tray" :data-open="$slots.chips ? '' : undefined">
      <div class="attach-inner">
        <div class="chips">
          <slot name="chips" />
        </div>
      </div>
    </div>
    <div class="glass-shell" :class="{ 'motion-card-glow': running }">
      <div class="glass-host">
        <div v-if="$slots.leading" class="leading">
          <slot name="leading" />
        </div>
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
    running?: boolean
    readonly?: boolean
  }>(),
  {
    placeholder: "do what you want ...",
    running: false,
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

.attach-tray {
  position: relative;
  z-index: 0;
  height: 0;
  overflow: hidden;
}
.attach-tray[data-open] {
  height: 68px;
  overflow: visible;
}

.attach-inner {
  position: absolute;
  inset-inline: var(--spacing-md);
  top: 0;
  bottom: -8px;
  display: flex;
  align-items: flex-start;
  background: var(--composer-bg);
  border: var(--border-width) solid var(--composer-ring);
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
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-soft);
}

.glass-host {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  grid-template-areas: "leading editor left right";
  align-items: center;
  column-gap: var(--spacing-xxs);
  padding: var(--spacing-xs);
  overflow: hidden;
  background: var(--composer-bg);
  border: var(--border-width) solid var(--composer-ring);
  border-radius: var(--radius-xl);
}
.composer[data-expanded="true"] .glass-host {
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "editor editor editor"
    "leading left right";
  align-items: end;
  row-gap: var(--spacing-xxs);
  padding: var(--spacing-sm) var(--spacing-xs) var(--spacing-xs);
}
.composer[data-multiline="true"] .glass-host {
  align-items: end;
}

.footer {
  min-width: 0;
  padding-inline: var(--spacing-xxs);
}

.leading,
.left,
.right {
  display: flex;
  align-items: center;
  gap: var(--spacing-xxs);
  flex: none;
}
.leading {
  grid-area: leading;
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
  padding-block-start: 3px;
  padding-inline: var(--spacing-xxs);
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
  line-height: 1.5;
  min-height: 22px;
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
