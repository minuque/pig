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
            aria-label="Prompt"
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

withDefaults(
  defineProps<{
    placeholder?: string
  }>(),
  {
    placeholder: "do what you want ...",
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
  const style = getComputedStyle(el)
  const line = Number.parseFloat(style.lineHeight) || 22

  const padY =
    (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0)

  multiline.value = next > line + padY + 2 || el.value.includes("\n")
}

watch(prompt, fitEditor, { flush: "post" })

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

.glass-host {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas: "editor left right";
  align-items: center;
  column-gap: var(--spacing-xs);
  padding-block: calc(var(--spacing-xs) + var(--border-width));
  padding-inline: calc(var(--spacing-sm) + var(--border-width));
  overflow: hidden;
  background: var(--composer-bg);
  border-radius: var(--radius-full);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-subtle);
}

/* 聚焦环叠透明度，避免 border-color 过渡在圆角上锯齿 */
.glass-host::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  box-shadow: inset 0 0 0 var(--border-width) var(--composer-ring);
  opacity: 0;
}

.glass-host:focus-within::after {
  opacity: 1;
}

.composer[data-expanded="true"] .glass-host {
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    "editor editor"
    "left right";
  align-items: end;
  row-gap: var(--spacing-xs);
  padding: calc(var(--spacing-sm) + var(--border-width));
}

.composer[data-multiline="true"] .glass-host {
  align-items: end;
  border-radius: 28px;
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
