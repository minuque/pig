<template>
  <article class="turn">
    <div v-if="part.kind === 'user'" class="turn-user">
      <p class="turn-prompt">{{ part.text }}</p>
    </div>
    <div v-else class="turn-agent">
      <FoldReveal v-if="part.thinking.length">
        <template #summary>思考过程</template>
        <div class="fold-body thinking-body">
          <MarkdownRender
            v-for="(block, i) in part.thinking"
            :key="i"
            v-bind="thinkProps"
            :content="block"
          />
        </div>
      </FoldReveal>
      <MarkdownRender v-if="part.text" v-bind="markdownProps" :content="part.text" />
      <span v-if="part.status === 'error' || part.status === 'aborted'" class="turn-status">
        {{ part.status === "error" ? "出错" : "已中止" }}
      </span>
    </div>
  </article>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue";
import { computed } from "vue";
import FoldReveal from "@features/session-workbench/components/FoldReveal.vue";
import { shouldVirtualizeMarkdown } from "@features/session-workbench/expandable-text.js";
import type { TranscriptPart } from "@features/session-workbench/transcript-format.js";
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js";

const props = withDefaults(
  defineProps<{
    part: Extract<TranscriptPart, { kind: "user" | "agent" }>;
    itemId?: string;
    /** 当前条目正在流式输出 */
    streaming?: boolean;
  }>(),
  { itemId: "", streaming: false },
);

const { isDark } = useColorScheme();
// 同一条 chat 行保持 mode=chat，只切换节奏，避免切 docs 重排；完成态才设 nodeVirtual。
const markdownProps = computed(() => {
  const shared = {
    customId: "chat",
    mode: "chat",
    codeRenderer: "monaco",
    fade: false,
    isDark: isDark.value,
    codeBlockProps: {
      showHeader: true,
      showCopyButton: true,
      showCollapseButton: true,
      showExpandButton: true,
    },
  } as const;
  if (props.streaming) {
    return { ...shared, typewriter: "simple", smoothStreaming: "auto" } as const;
  }
  const long = shouldVirtualizeMarkdown(props.part.kind === "agent" ? props.part.text : "");
  return {
    ...shared,
    final: true,
    typewriter: false,
    smoothStreaming: false,
    nodeVirtual: "auto",
    ...(long && props.itemId
      ? {
          maxLiveNodes: 48,
          virtualScroll: { enabled: true as const, sessionKey: `msg:${props.itemId}` },
        }
      : {}),
  } as const;
});
// 思考块最小直配：minimal 模式默认 fade=false、maxLiveNodes=0，只需关节奏。
const thinkProps = computed(
  () =>
    ({
      customId: "chat",
      mode: "minimal",
      codeRenderer: "pre",
      final: true,
      typewriter: false,
      smoothStreaming: false,
      isDark: isDark.value,
    }) as const,
);
</script>

<style scoped>
.turn {
  margin-bottom: var(--spacing-lg);
}
.turn-user {
  display: flex;
  justify-content: flex-end;
}
.turn-prompt {
  box-sizing: border-box;
  width: fit-content;
  max-width: min(40rem, 86%);
  max-height: calc(1.5em * 16);
  margin: 0;
  padding: 8px 14px;
  overflow: auto;
  border-radius: var(--radius-xl);
  background: var(--canvas-soft);
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.turn-agent {
  padding: 2px 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.7;
}
.turn-status {
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
