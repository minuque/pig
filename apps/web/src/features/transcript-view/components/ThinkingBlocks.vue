<template>
  <div ref="viewport" class="thinking-body" :class="{ streaming }">
    <MarkdownRender
      v-for="(block, index) in blocks"
      :key="index"
      v-bind="thinkProps"
      :content="block"
    />
  </div>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue"
import { computed, nextTick, useTemplateRef, watch } from "vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

const props = withDefaults(
  defineProps<{
    blocks: readonly string[]
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const viewport = useTemplateRef<HTMLElement>("viewport")
watch(
  () => [props.blocks.join("\n"), props.streaming] as const,
  async ([, streaming]) => {
    if (!streaming) return
    await nextTick()
    const root = viewport.value
    if (root) root.scrollTop = root.scrollHeight
  },
  { immediate: true, flush: "post" },
)
const thinkProps = computed(
  () =>
    ({
      customId: "chat",
      mode: "minimal",
      renderCodeBlocksAsPre: true,
      final: true,
      typewriter: false,
      smoothStreaming: false,
      isDark: isDark.value,
      codeBlockOptions: codeBlockTypography(),
      codeBlockProps: codeBlockProps.value,
    }) as const,
)
</script>

<style scoped>
.thinking-body {
  max-height: calc(var(--text-body-sm) * var(--text-body-sm--line-height) * 5);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  font-size: var(--text-body-sm);
}
.thinking-body.streaming {
  scrollbar-gutter: stable;
}
.thinking-body :deep(p) {
  margin: 0 0 var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
  white-space: pre-wrap;
}
.thinking-body > :last-child :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
