<template>
  <div
    data-slot="text-field-root"
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    :class="props.class"
    @pointerdown="onPointerDown"
  >
    <input
      ref="inputRef"
      data-slot="text-field-input"
      spellcheck="false"
      :value="modelValue"
      v-bind="$attrs"
      @input="onInput"
    />

    <slot />
  </div>
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ref } from "vue"
import type { Size, ToneColor } from "@/types/ui-type.js"
import type { Radius } from "@components/ui/button/index.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string | number
    size?: Size
    variant?: "surface" | "soft"
    color?: ToneColor
    radius?: Radius
    class?: HTMLAttributes["class"]
  }>(),
  { size: "m", variant: "surface", class: undefined },
)
const emit = defineEmits<{ "update:modelValue": [value: string] }>()
const inputRef = ref<HTMLInputElement>()

defineExpose({ focus: () => inputRef.value?.focus() })

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLInputElement).value)
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as HTMLElement

  if (target.closest("input, button, a")) return

  const input = inputRef.value

  if (!input) return

  const isRightSlot = target.closest(
    '[data-slot="text-field-slot"][data-side="right"], [data-slot="text-field-slot"]:not([data-side="right"]) ~ [data-slot="text-field-slot"]:not([data-side="left"])',
  )
  const caret = isRightSlot ? input.value.length : 0

  requestAnimationFrame(() => {
    try {
      input.setSelectionRange(caret, caret)
    } catch {
      // 外部：部分 input type 不支持 setSelectionRange
    }

    input.focus()
  })
}
</script>

<style>
:where([data-slot="text-field-root"]) {
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  height: var(--control-md);
  padding: var(--border-width);
  border-radius: var(--radius-control);
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-align: start;
}

:where([data-slot="text-field-root"]:has([data-slot="text-field-input"]:focus)) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-slot="text-field-input"]:focus-visible) {
  outline: none;
}

:where([data-slot="text-field-root"][data-radius="none"]) {
  border-radius: 0;
}

:where([data-slot="text-field-root"][data-radius="small"]) {
  border-radius: calc(var(--radius-control) / 2);
}

:where([data-slot="text-field-root"][data-radius="medium"]) {
  border-radius: var(--radius-control);
}

:where([data-slot="text-field-root"][data-radius="large"]) {
  border-radius: var(--radius-card);
}

:where([data-slot="text-field-root"][data-radius="full"]) {
  border-radius: var(--radius-pill);
}

:where([data-slot="text-field-root"]) ::selection {
  background-color: var(--bg-selected);
}

:where([data-slot="text-field-root"][data-size="s"]) {
  height: var(--space-lg);
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="text-field-root"][data-size="s"]) :where([data-slot="text-field-input"]) {
  text-indent: calc(var(--space-2xs) * 1.5 - var(--border-width));
}

:where([data-slot="text-field-root"][data-size="s"]) :where([data-slot="text-field-slot"]) {
  gap: var(--space-xs);
  padding-inline: var(--space-2xs);
}

:where([data-slot="text-field-root"][data-size="m"]) {
  height: var(--control-md);
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="text-field-root"][data-size="m"]) :where([data-slot="text-field-input"]) {
  text-indent: calc(var(--space-xs) - var(--border-width));
}

:where([data-slot="text-field-root"][data-size="m"]) :where([data-slot="text-field-slot"]) {
  gap: var(--space-xs);
  padding-inline: var(--space-xs);
}

:where([data-slot="text-field-root"][data-size="l"]) {
  height: var(--control-lg);
  font-size: var(--text-title);
  line-height: var(--text-title--line-height);
}

:where([data-slot="text-field-root"][data-size="l"]) :where([data-slot="text-field-input"]) {
  text-indent: calc(var(--space-sm) - var(--border-width));
}

:where([data-slot="text-field-root"][data-size="l"]) :where([data-slot="text-field-slot"]) {
  gap: var(--space-sm);
  padding-inline: var(--space-sm);
}

:where([data-slot="text-field-input"]) {
  display: flex;
  align-items: center;
  inline-size: 100%;
  text-align: inherit;
  border-radius: inherit;
  background-color: transparent;
  color: inherit;
}

:where(
  [data-slot="text-field-input"]:has(~ [data-slot="text-field-slot"]:not([data-side="right"]))
) {
  text-indent: 0;
  padding-inline-start: 0;
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}

:where(
  [data-slot="text-field-input"]:has(
    ~ [data-slot="text-field-slot"][data-side="right"],
    ~ [data-slot="text-field-slot"]:not([data-side="right"])
      ~ [data-slot="text-field-slot"]:not([data-side="left"])
  )
) {
  padding-inline-end: 0;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

:where([data-slot="text-field-slot"]) {
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  cursor: text;
  color: var(--fg-secondary);
}

:where([data-slot="text-field-slot"][data-tone]) {
  color: var(--tone-text);
}

:where([data-slot="text-field-slot"]:not([data-side="right"])) {
  order: -1;
  margin-inline-start: calc(var(--border-width) * -1);
  margin-inline-end: 0;
}

:where([data-slot="text-field-slot"][data-side="right"]),
:where(
  [data-slot="text-field-slot"]:not([data-side="right"])
    ~ [data-slot="text-field-slot"]:not([data-side="left"])
) {
  order: 0;
  margin-inline-start: 0;
  margin-inline-end: calc(var(--border-width) * -1);
}

:where([data-slot="text-field-root"][data-variant="surface"]) {
  background-clip: content-box;
  background-color: var(--bg-raised);
  box-shadow: inset 0 0 0 var(--border-width) var(--border-input);
  color: var(--fg);
}

:where([data-slot="text-field-root"][data-variant="surface"]) ::placeholder {
  color: var(--fg-muted);
}

:where([data-slot="text-field-root"][data-variant="surface"]):has(
  [data-slot="text-field-input"]:where(:disabled, :read-only)
) {
  background-image: linear-gradient(var(--bg-muted), var(--bg-muted));
  box-shadow: inset 0 0 0 var(--border-width) var(--border-strong);
}

:where([data-slot="text-field-root"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  color: var(--fg);
}

:where([data-slot="text-field-root"][data-variant="soft"]) ::placeholder {
  color: var(--fg);
  opacity: 0.6;
}

:where([data-slot="text-field-root"][data-variant="soft"]):has(
  [data-slot="text-field-input"]:where(:disabled, :read-only)
) {
  background-color: var(--bg-muted);
}

:where([data-slot="text-field-input"]:where(:disabled, :read-only)) {
  cursor: text;
  color: var(--fg-secondary);
  -webkit-text-fill-color: var(--fg-secondary);
}

:where([data-slot="text-field-input"]:where(:disabled, :read-only))::placeholder {
  opacity: 0.5;
}

:where([data-slot="text-field-input"]:where(:disabled, :read-only):placeholder-shown) {
  cursor: default;
}
</style>
