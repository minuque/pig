<template>
  <div ref="root" data-slot="select-search">
    <SearchIcon aria-hidden="true" data-slot="select-search-icon" />
    <SelectInputPrimitive v-bind="$attrs" :placeholder="placeholder" :aria-label="ariaLabel" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, useAttrs, useTemplateRef } from "vue"
import { SearchIcon } from "@lucide/vue"
import { SelectInput as SelectInputPrimitive } from "@ui-sdk/vue/select"

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: "" })
const attrs = useAttrs()
const root = useTemplateRef<HTMLElement>("root")
const ariaLabel = computed(() => {
  const raw = attrs["aria-label"]

  if (typeof raw === "string" && raw) return raw
  return props.placeholder || undefined
})

onMounted(() =>
  requestAnimationFrame(() => {
    const content = root.value?.closest<HTMLElement>('[data-slot="select-content"]')

    if (content) content.style.inlineSize = `${content.getBoundingClientRect().width}px`
  }),
)
</script>

<style>
:where([data-slot="select-search"]) {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-xs);
  block-size: var(--control-md);
  padding-inline: var(--space-xs);
  border-block-end: var(--border-width) solid var(--border-subtle);
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-search"]) {
  block-size: var(--control-sm);
}

:where([data-slot="select-search-icon"]) {
  flex: none;
  color: var(--fg-muted);
}

:where([data-slot="select-input"]) {
  flex: 1;
  inline-size: 0;
  min-inline-size: 0;
  block-size: 100%;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--fg);
  font: inherit;
  font-size: var(--text-body);
  line-height: var(--text-body--line-height);
}

:where([data-slot="select-content"][data-size="s"]) :where([data-slot="select-input"]) {
  font-size: var(--text-meta);
  line-height: var(--text-meta--line-height);
}

:where([data-slot="select-input"])::placeholder {
  color: var(--fg-muted);
}
</style>
