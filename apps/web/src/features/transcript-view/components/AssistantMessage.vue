<template>
  <article ref="root">
    <div
      v-if="text && !ready"
      class="md-placeholder"
      :style="{ minHeight: `${slotPx}px` }"
      aria-hidden="true"
    ></div>
    <MarkdownRender v-else-if="text" v-bind="agentMarkdown" :content="text" />

    <Alert
      v-if="item.error || item.aborted"
      class="status-alert"
      :variant="item.error ? 'error' : 'warning'"
    >
      <CircleAlert />
      <AlertTitle>{{ statusLabel }}</AlertTitle>
      <AlertDescription v-if="item.errorMessage">{{ item.errorMessage }}</AlertDescription>
    </Alert>
    <MessageTimestamp
      v-if="item.showTimestamp"
      class="message-stamp"
      :timestamp="item.timestamp"
      :text="item.text"
    />
  </article>
</template>

<script setup lang="ts">
import { CircleAlert } from "@lucide/vue"
import MarkdownRender, { type NodeRendererProps } from "markstream-vue"
import { computed, inject, shallowRef, useTemplateRef, watch } from "vue"
import Alert from "@components/ui/alert/Alert.vue"
import AlertDescription from "@components/ui/alert/AlertDescription.vue"
import AlertTitle from "@components/ui/alert/AlertTitle.vue"
import MessageTimestamp from "@features/transcript-view/components/MessageTimestamp.vue"
import type { AssistantRow } from "@features/transcript-view/type.js"
import { useNearViewport } from "@features/transcript-view/hooks/use-near-viewport.js"
import { useTranscriptReveal } from "@features/transcript-view/hooks/use-transcript-reveal.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"
import { codeBlockTypography } from "@features/transcript-view/lib/code-block-options.js"
import {
  estimateMarkdownSlotPx,
  transcriptScrollRootKey,
} from "@features/transcript-view/lib/transcript-markdown.js"

const props = withDefaults(
  defineProps<{
    item: AssistantRow
    streaming?: boolean
  }>(),
  { streaming: false },
)

const { isDark, codeBlockProps } = useColorScheme()
const root = useTemplateRef<HTMLElement>("root")
const scrollRoot = inject(transcriptScrollRootKey, () => null)
const richBlocks = shallowRef(props.streaming)

watch(
  () => props.streaming,
  (live) => {
    if (live) richBlocks.value = true
  },
)

const ready = useNearViewport(root, scrollRoot, () => props.streaming)

const text = useTranscriptReveal(
  () => props.item.text,
  () => props.streaming,
)

const slotPx = computed(() => estimateMarkdownSlotPx(text.value))

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

const agentMarkdown = computed((): NodeRendererProps => {
  const streaming = props.streaming
  const rich = richBlocks.value
  return {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: isDark.value,
    viewportPriority: !streaming,
    deferNodesUntilVisible: !streaming,
    codeBlockOptions,
    codeBlockProps: {
      ...codeBlockProps.value,
      showHeader: rich,
      showCopyButton: rich,
      showCollapseButton: rich,
      showExpandButton: rich,
    },
    mermaidProps: {
      renderDebounceMs: 180,
      contentStableDelayMs: 500,
      showHeader: true,
      showFullscreenButton: true,
    },
    final: !streaming,
    typewriter: false,
    smoothStreaming: false,
    nodeVirtual: !streaming,
    batchRendering: !streaming,
    renderCodeBlocksAsPre: !rich,
    ...(streaming ? { maxLiveNodes: 0 } : {}),
  }
})
</script>

<style scoped>
.md-placeholder {
  box-sizing: border-box;
  width: 100%;
}

.status-alert {
  margin-top: var(--spacing-xs);
}
.status-alert:first-child {
  margin-top: 0;
}

.message-stamp {
  margin-top: var(--spacing-xs);
}
</style>
