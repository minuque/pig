<template>
  <TextareaPrimitive
    ref="textareaRef"
    data-textarea
    :data-size="size"
    :data-variant="variant"
    :data-tone="color"
    :data-radius="radius"
    v-bind="textareaProps()"
    :class="props.class"
    @value-change="(value: string) => emit('update:modelValue', value)"
    @submit="(value: string) => emit('submit', value)"
  />
</template>

<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { computed, useAttrs, useTemplateRef } from "vue"
import { Textarea as TextareaPrimitive } from "@ui-sdk/vue/textarea"
import type { Radius, Size, ToneColor } from "../../core/types.js"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    modelValue?: string
    size?: Size
    variant?: "surface" | "soft"
    color?: ToneColor
    radius?: Radius
    invalid?: boolean
    autoResize?: boolean
    submitShortcut?: "enter" | "mod+enter"
    class?: HTMLAttributes["class"]
  }>(),
  {
    size: "m",
    variant: "surface",
    invalid: false,
    class: undefined,
  },
)
const emit = defineEmits<{
  "update:modelValue": [value: string]
  submit: [value: string]
}>()
const textarea = useTemplateRef<{ $el: HTMLTextAreaElement }>("textareaRef")
const attrs = useAttrs()
const el = computed(() => textarea.value?.$el ?? null)

function textareaProps() {
  return {
    ...attrs,
    ...(props.modelValue === undefined ? {} : { value: props.modelValue }),
    ...(props.autoResize === undefined ? {} : { autoResize: props.autoResize }),
    ...(props.submitShortcut === undefined ? {} : { submitShortcut: props.submitShortcut }),
    ...(props.invalid ? { "aria-invalid": true, "data-invalid": "" } : {}),
  }
}

defineExpose({
  focus: () => el.value?.focus(),
  el,
})
</script>

<style>
:where([data-slot="textarea"]) {
  box-sizing: border-box;
  display: block;
  inline-size: 100%;
  min-block-size: var(--control-md);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-control);
  background-clip: padding-box;
  font-family: var(--font-sans);
  font-weight: var(--font-weight-normal);
  font-style: normal;
  text-align: start;
  resize: vertical;
}

:where([data-slot="textarea"]:focus-visible) {
  outline: 2px solid var(--focus-color);
  outline-offset: -1px;
}

:where([data-slot="textarea"])::selection {
  background-color: var(--bg-selected);
}

:where([data-slot="textarea"][data-size="s"]) {
  min-block-size: var(--control-sm);
  padding: calc(var(--space-2xs) - var(--border-width))
    calc(var(--space-2xs) * 1.5 - var(--border-width));
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="textarea"][data-size="m"]) {
  min-block-size: var(--control-md);
  padding: calc(var(--space-2xs) * 1.5 - var(--border-width))
    calc(var(--space-xs) - var(--border-width));
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="textarea"][data-variant="surface"]) {
  border-color: var(--control-border);
  background-color: var(--control-bg);
  color: var(--fg);
}

:where([data-slot="textarea"][data-variant="surface"])::placeholder {
  color: var(--fg-muted);
}

:where([data-slot="textarea"][data-variant="surface"]:where(:disabled, :read-only)) {
  border-color: var(--border-strong);
  background-image: linear-gradient(var(--bg-muted), var(--bg-muted));
}

:where([data-slot="textarea"][data-variant="soft"]) {
  background-color: var(--tone-subtle);
  color: var(--fg);
}

:where([data-slot="textarea"][data-variant="soft"])::placeholder {
  color: var(--fg);
  opacity: 0.6;
}

:where([data-slot="textarea"][data-variant="soft"]:where(:disabled, :read-only)) {
  background-color: var(--bg-muted);
}

:where([data-slot="textarea"]:where(:disabled, :read-only)) {
  cursor: text;
  color: var(--fg-secondary);
  -webkit-text-fill-color: var(--fg-secondary);
}

:where([data-slot="textarea"]:where(:disabled, :read-only))::placeholder {
  opacity: 0.5;
}

:where([data-slot="textarea"]:where(:disabled, :read-only):placeholder-shown) {
  cursor: default;
}

:where([data-slot="textarea"][data-invalid]) {
  border-color: var(--danger-text);
}

:where([data-slot="textarea"][data-invalid]:focus-visible) {
  outline-color: var(--danger-text);
}
</style>
