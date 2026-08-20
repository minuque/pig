<template>
  <article class="assistant">
    <FoldReveal v-if="thinking.length">
      <template #summary>思考过程</template>
      <div class="fold-body thinking-body">
        <MarkdownRender
          v-for="(block, index) in thinking"
          :key="index"
          v-bind="thinkProps"
          :content="block"
        />
      </div>
    </FoldReveal>
    <MarkdownRender v-if="text" v-bind="agentMarkdown" :content="text" />
    <span v-if="item.status === 'error' || item.status === 'aborted'" class="status">
      {{ item.status === "error" ? "出错" : "已中止" }}
    </span>
  </article>
</template>

<script setup lang="ts">
import MarkdownRender, { type MarkstreamVirtualMarkdownProps } from "markstream-vue";
import { computed } from "vue";
import type { AssistantTranscriptItem } from "@earendil-works/pi-protocol";
import FoldReveal from "@features/session-workbench/components/FoldReveal.vue";
import {
  assistantThinking,
  transcriptText,
} from "@features/session-workbench/lib/transcript-format.js";
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js";

const props = withDefaults(
  defineProps<{
    item: AssistantTranscriptItem;
    streaming?: boolean;
    // eslint-disable-next-line vue/require-default-prop -- 时间线 slot 仅助手行传入
    timelineMarkdown?: MarkstreamVirtualMarkdownProps;
  }>(),
  { streaming: false },
);

const { isDark } = useColorScheme();
const text = computed(() => transcriptText(props.item));
const thinking = computed(() => assistantThinking(props.item));

const agentMarkdown = computed(() => {
  const shared = {
    customId: "chat",
    mode: "chat",
    fade: false,
    isDark: isDark.value,
    codeBlockProps: {
      showHeader: true,
      showCopyButton: true,
      showCollapseButton: true,
      showExpandButton: true,
    },
  } as const;
  const timeline = props.timelineMarkdown;
  if (props.streaming) {
    return {
      ...timeline,
      ...shared,
      final: timeline?.final ?? false,
      typewriter: "simple",
      smoothStreaming: "auto",
    } as const;
  }
  return {
    ...timeline,
    ...shared,
    final: timeline?.final ?? true,
    typewriter: false,
    smoothStreaming: false,
  } as const;
});

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
    }) as const,
);
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
.fold-body {
  padding: 2px 0 4px 22px;
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
