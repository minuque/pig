<template>
  <article class="assistant">
    <ThinkingReasoning v-if="thinking.length" :streaming="streaming" :content="thinkingText">
      <div class="thinking-body">
        <MarkdownRender
          v-for="(block, index) in thinking"
          :key="index"
          v-bind="thinkProps"
          :content="block"
        />
      </div>
    </ThinkingReasoning>
    <ThinkingWait v-else-if="streaming && !text" />
    <MarkdownRender
      v-if="text"
      v-bind="agentMarkdown"
      :content="text"
      @render-settled="emit('render-settled')"
      @render-final="emit('render-settled')"
    />
    <span v-if="item.status === 'error' || item.status === 'aborted'" class="status">
      {{ item.status === "error" ? "出错" : "已中止" }}
    </span>
  </article>
</template>

<script setup lang="ts">
import MarkdownRender, { type MarkstreamVirtualMarkdownProps } from "markstream-vue"
import { computed, onBeforeMount, onMounted } from "vue"
import type { AssistantTranscriptItem } from "@earendil-works/pi-protocol"
import ThinkingReasoning from "@features/transcript-view/components/ThinkingReasoning.vue"
import ThinkingWait from "@features/transcript-view/components/ThinkingWait.vue"
import {
  assistantThinking,
  transcriptText,
} from "@features/transcript-view/lib/transcript-format.js"
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js"

const props = withDefaults(
  defineProps<{
    item: AssistantTranscriptItem
    streaming?: boolean
    // eslint-disable-next-line vue/require-default-prop -- 时间线 slot 仅助手行传入
    timelineMarkdown?: MarkstreamVirtualMarkdownProps
  }>(),
  { streaming: false },
)

const emit = defineEmits<{
  "render-pending": []
  "render-settled": []
}>()

const { isDark } = useColorScheme()
const text = computed(() => transcriptText(props.item))
const thinking = computed(() => assistantThinking(props.item))
const thinkingText = computed(() => thinking.value.join("\n\n"))

onBeforeMount(() => {
  if (text.value && !props.streaming) emit("render-pending")
})
onMounted(() => {
  if (!text.value || props.streaming) emit("render-settled")
})

const codeBlockOptions = {
  fontSize: 14,
  fontFamily: "var(--font-code)",
} as const
const agentMarkdown = computed(() => {
  const shared = {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: isDark.value,
    codeBlockOptions,
    codeBlockProps: {
      showHeader: true,
      showCopyButton: true,
      showCollapseButton: true,
      showExpandButton: true,
      theme: "dark-plus",
    },
  } as const
  const timeline = props.timelineMarkdown
  if (props.streaming) {
    return {
      ...timeline,
      ...shared,
      final: timeline?.final ?? false,
      typewriter: "simple",
      smoothStreaming: "auto",
    } as const
  }
  return {
    ...timeline,
    ...shared,
    final: timeline?.final ?? true,
    typewriter: false,
    smoothStreaming: false,
  } as const
})

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
      codeBlockOptions,
      codeBlockProps: { theme: "dark-plus" },
    }) as const,
)
</script>

<style scoped>
.assistant {
  margin-bottom: var(--spacing-lg);
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
.thinking-body :deep(p) {
  margin: 0 0 var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-caption);
  line-height: 1.55;
  white-space: pre-wrap;
}
.thinking-body > :last-child :deep(p:last-child) {
  margin-bottom: 0;
}
</style>
