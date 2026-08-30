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
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark } = useColorScheme()
const text = computed(() => props.item.text)
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
const agentMarkdown = computed(() => {
  const shared = {
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
      theme: "dark-plus",
    },
  } as const
  if (props.streaming) {
    return {
      ...shared,
      final: false,
      typewriter: "simple",
      smoothStreaming: "auto",
    } as const
  }
  return {
    ...shared,
    final: true,
    typewriter: false,
    smoothStreaming: false,
  } as const
})
</script>

<style scoped>
.assistant {
  padding: 2px 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.7;
}
.status {
  display: inline-block;
  margin-top: var(--spacing-xs);
  padding: 2px 8px;
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
