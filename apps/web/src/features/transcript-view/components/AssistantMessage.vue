<template>
  <article class="assistant">
    <MarkdownRender v-if="text" v-bind="agentMarkdown" :content="text" />
    <span v-if="item.error || item.aborted" class="status">
      {{ statusLabel }}
    </span>
    <p v-if="item.errorMessage" class="error-detail">{{ item.errorMessage }}</p>
  </article>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue"
import { computed } from "vue"
import type { AssistantRow } from "@features/transcript-view/lib/transcript-rows.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"

function assistantMarkdownFlags(streaming: boolean) {
  return {
    final: !streaming,
    typewriter: false as const,
    smoothStreaming: false as const,
    maxLiveNodes: 0,
    nodeVirtual: false as const,
    batchRendering: false,
  }
}

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const text = useTranscriptReveal(
  () => props.item.text,
  () => props.streaming,
)
const statusLabel = computed(() => {
  const base = props.item.error ? "出错" : "已中止"
  const retries = props.item.retryCount
  if (retries && retries > 1) return `${base} · ${retries} 次`
  return base
})

const codeBlockOptions = {
  ...codeBlockTypography(),
  diffStyle: "unified",
} as const
const agentMarkdown = computed(
  () =>
    ({
      customId: "chat",
      mode: "chat",
      fade: false,
      isDark: isDark.value,
      viewportPriority: false,
      codeBlockOptions,
      codeBlockProps: {
        ...codeBlockProps.value,
        showHeader: true,
        showCopyButton: true,
        showCollapseButton: true,
        showExpandButton: true,
      },
      mermaidProps: {
        renderDebounceMs: 180,
        contentStableDelayMs: 500,
        showHeader: true,
        showFullscreenButton: true,
      },
      ...assistantMarkdownFlags(props.streaming),
    }) as const,
)
</script>

<style scoped>
.assistant {
  padding: 2px 0;
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
}

.status {
  color: var(--danger);
  font-size: var(--text-body-md);
  font-weight: var(--font-weight-medium);
}

.error-detail {
  margin: 6px 0 0;
  color: var(--danger);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
