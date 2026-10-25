<template>
  <blockquote v-if="thoughtContent" class="thought">
    <MarkdownRender
      v-if="thoughtContent.text"
      v-bind="thoughtProps"
      :content="thoughtContent.text"
    />
  </blockquote>
</template>

<script setup lang="ts">
import { computed } from "vue"
import MarkdownRender from "markstream-vue"
import { useColorScheme } from "@features/theme/index.js"
import { plainMarkdownProps } from "@features/transcript-view/lib/markdown-render-props.js"

const props = defineProps<{
  variant: "thought" | "read" | "edit" | "tool"
  text?: string
  streaming?: boolean
}>()
const thoughtContent = computed(() =>
  props.variant === "thought"
    ? { text: props.text ?? "", streaming: props.streaming ?? false }
    : null,
)
const { isDark } = useColorScheme()
const thoughtProps = computed(() =>
  plainMarkdownProps({ streaming: Boolean(thoughtContent.value?.streaming), isDark: isDark.value }),
)
</script>

<style scoped>
.thought {
  margin: 0;
  padding-inline-start: calc(var(--size-icon) + var(--space-xs));
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-meta);
  line-height: var(--text-body-sm--line-height);
}

.thought
  :deep(
    :is([data-custom-id="thought"], p, .paragraph-node, h1, h2, h3, h4, h5, h6, li, pre, code)
  ) {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--contrast-foreground-muted);
  font-size: var(--text-meta);
  font-family: inherit;
  white-space: pre-wrap;
}

.thought :deep(.code-block-header),
.thought :deep(.code-header-actions) {
  display: none;
}

.thought :deep(.code-block-container) {
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}
</style>
