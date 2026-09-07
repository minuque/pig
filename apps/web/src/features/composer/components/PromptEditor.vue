<template>
  <div
    ref="container"
    class="composer motion-composer"
    :data-expanded="expanded"
    @mousedown="onComposerMousedown"
    @focusin="focused = true"
    @focusout="onFocusOut"
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
        <div class="row">
          <div class="left" :inert="!expanded" :aria-hidden="!expanded">
            <slot name="left" />
          </div>
          <div class="right">
            <slot name="right" :expanded="expanded" />
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
import { computed, ref, shallowRef, watch } from "vue"

const props = withDefaults(
  defineProps<{
    placeholder?: string
    running?: boolean
    active?: boolean
    hasChips?: boolean
    readonly?: boolean
  }>(),
  {
    placeholder: "do what you want ...",
    running: false,
    active: false,
    hasChips: false,
    readonly: false,
  },
)

const prompt = defineModel<string>("prompt", { required: true })

const emit = defineEmits<{
  submit: []
}>()

const editor = ref<HTMLTextAreaElement | null>(null)
const focused = shallowRef(false)
const container = ref<HTMLElement | null>(null)

const hasText = computed(() => prompt.value.length > 0)
const expanded = computed(
  () => focused.value || hasText.value || props.hasChips || props.running || props.active,
)

function onFocusOut(event: FocusEvent) {
  focused.value =
    event.relatedTarget instanceof Node && Boolean(container.value?.contains(event.relatedTarget))
}

function focus() {
  const el = editor.value
  if (!el) return
  el.focus()
  el.selectionStart = el.selectionEnd = el.value.length
}

watch(prompt, () => {
  if (!props.readonly) return
  const el = editor.value
  if (el) el.scrollTop = el.scrollHeight
})

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
  background: var(--surface);
  border: var(--border-width) solid var(--hairline);
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
}
.glass-host {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-xl);
}

.editor-wrap {
  padding: var(--spacing-sm) var(--spacing-md);
  padding-inline-end: calc(var(--size-icon-button) + var(--spacing-lg));
}
.composer[data-expanded="true"] .editor-wrap {
  padding: 14px var(--spacing-md) 48px;
}

.composer[data-expanded="true"] .field {
  min-height: 44px;
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
  gap: var(--spacing-xxs);
  min-width: 0;
  flex: 1;
}
.composer[data-expanded="false"] .left {
  visibility: hidden;
  opacity: 0;
  transform: translateY(var(--spacing-xxs));
}
.composer[data-expanded="false"] .row {
  inset-inline-start: auto;
}
.right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
</style>
