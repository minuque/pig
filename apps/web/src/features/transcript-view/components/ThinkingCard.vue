<template>
  <div class="thinking-card">
    <div ref="viewport" class="thinking-body">
      <MarkdownRender v-if="text" v-bind="thinkProps" :content="text" />
    </div>
  </div>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue"
import { computed, nextTick, useTemplateRef, watch } from "vue"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
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
const text = useTranscriptReveal(
  () => props.blocks.join("\n"),
  () => props.streaming,
)

const thinkProps = computed(
  () =>
    ({
      customId: "chat",
      mode: "minimal",
      renderCodeBlocksAsPre: true,
      final: !props.streaming,
      typewriter: false,
      smoothStreaming: false,
      isDark: isDark.value,
      codeBlockOptions: codeBlockTypography(),
      codeBlockProps: codeBlockProps.value,
    }) as const,
)

watch(
  () => [text.value, props.streaming] as const,
  async ([, streaming]) => {
    if (!streaming) return
    await nextTick()
    const root = viewport.value
    if (root) root.scrollTop = root.scrollHeight
  },
  { flush: "post" },
)
</script>

<style scoped>
.thinking-card {
  min-width: 0;
  padding: var(--spacing-sm);
}

.thinking-body {
  min-width: 0;
  max-height: calc(var(--text-body-sm) * var(--text-body-sm--line-height) * 12);
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
}

.thinking-body :deep(p),
.thinking-body :deep(.paragraph-node) {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--text-body-sm);
  line-height: var(--text-body-sm--line-height);
  white-space: pre-wrap;
}
.thinking-body > :last-child :deep(p:last-child),
.thinking-body > :last-child :deep(.paragraph-node:last-child) {
  margin-bottom: 0;
}
</style>
