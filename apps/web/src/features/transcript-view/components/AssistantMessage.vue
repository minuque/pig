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

const { isDark } = useColorScheme()
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
  fontSize: 14,
  // 与 stream-diffs 实际行高对齐
  lineHeight: 18,
  fontFamily: "var(--font-code)",
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
        showHeader: true,
        showCopyButton: true,
        showCollapseButton: true,
        showExpandButton: true,
        theme: isDark.value ? "dark-plus" : "light-plus",
      },
      ...assistantMarkdownFlags(props.streaming),
    }) as const,
)
</script>

<style scoped>
.assistant {
  padding: 2px 0;
  color: var(--ink);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
.status {
  display: inline-block;
  margin-top: var(--spacing-xs);
  padding: 2px var(--spacing-xs);
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.error-detail {
  margin: 6px 0 0;
  color: var(--danger);
  font-size: var(--text-caption);
  line-height: var(--text-caption--line-height);
}
</style>
