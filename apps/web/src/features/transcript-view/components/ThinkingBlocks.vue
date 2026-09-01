<template>
  <div class="thinking-body">
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
import { computed } from "vue"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

defineProps<{
  blocks: readonly string[]
}>()

const { isDark } = useColorScheme()
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
      codeBlockProps: { theme: "dark-plus" },
    }) as const,
)
</script>

<style scoped>
.thinking-body {
  max-height: 180px;
  overflow: auto;
  font-size: var(--text-body-sm);
}
.thinking-body :deep(p) {
  margin: 0 0 var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  line-height: 1.55;
  white-space: pre-wrap;
}
.thinking-body > :last-child :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
