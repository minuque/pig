<template>
  <article class="turn">
    <div v-if="part.kind === 'user'" class="turn-user">
      <span class="turn-label">你</span>
      <p class="turn-prompt">{{ part.text }}</p>
    </div>
    <div v-else class="turn-agent">
      <div v-if="part.thinking.length" class="fold">
        <button
          type="button"
          class="fold-toggle"
          :aria-expanded="thinkingOpen"
          @click="thinkingOpen = !thinkingOpen"
        >
          <span class="fold-caret" aria-hidden="true">▸</span>
          思考过程
        </button>
        <div class="reveal" :data-open="thinkingOpen">
          <div class="fold-clip">
            <div class="fold-body thinking-body">
              <p v-for="(block, i) in part.thinking" :key="i">{{ block }}</p>
            </div>
          </div>
        </div>
      </div>
      <MarkdownRender v-if="part.text" v-bind="chatMarkdownProps(streaming)" :content="part.text" />
      <span v-if="part.status === 'error' || part.status === 'aborted'" class="turn-status">
        {{ part.status === "error" ? "出错" : "已中止" }}
      </span>
    </div>
  </article>
</template>

<script lang="ts">
/** 同一条 chat 行保持 mode=chat；只切换节奏，避免切 docs 重排。 */
export function chatMarkdownProps(streaming: boolean) {
  return {
    customId: "chat",
    mode: "chat" as const,
    codeRenderer: "pre" as const,
    htmlPolicy: "safe" as const,
    final: !streaming,
    smoothStreaming: streaming ? ("auto" as const) : false,
    typewriter: streaming ? ("simple" as const) : false,
    fade: false,
  };
}
</script>

<script setup lang="ts">
import MarkdownRender from "markstream-vue";
import { shallowRef } from "vue";
import type { TranscriptPart } from "@features/session-workbench/transcript-format.js";

withDefaults(
  defineProps<{
    part: Extract<TranscriptPart, { kind: "user" | "agent" }>;
    /** 当前条目正在流式输出 */
    streaming?: boolean;
  }>(),
  { streaming: false },
);

const thinkingOpen = shallowRef(false);
</script>

<style scoped>
.turn {
  margin-bottom: var(--spacing-md);
}
.turn-user {
  display: grid;
  gap: var(--spacing-xxs);
}
.turn-label {
  color: var(--ink-muted);
  font-size: var(--text-caption);
}
.turn-prompt {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--canvas-soft);
  color: var(--ink-secondary);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.turn-agent {
  padding: var(--spacing-xs) 0;
  color: var(--ink);
  font-size: var(--text-body-md);
  line-height: var(--text-body-md--line-height);
}
.reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-smooth);
}
.reveal[data-open="true"] {
  grid-template-rows: 1fr;
}
.fold-clip {
  overflow: hidden;
  min-height: 0;
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
.fold {
  margin-bottom: var(--spacing-xxs);
}
.fold-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  min-height: 0;
  padding: var(--spacing-xxs) 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.fold-toggle:hover {
  color: var(--ink);
}
.fold-caret {
  display: inline-block;
  font-size: 10px;
  transition: transform var(--duration-fast) var(--ease-smooth);
}
.fold-toggle[aria-expanded="true"] .fold-caret {
  transform: rotate(90deg);
}
.fold-body {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-left: 2px solid var(--hairline);
}
.thinking-body p {
  margin: 0 0 var(--spacing-xs);
  color: var(--ink-muted);
  font-size: var(--text-body-sm);
  white-space: pre-wrap;
}
.thinking-body p:last-child {
  margin-bottom: 0;
}
@media (prefers-reduced-motion: reduce) {
  .reveal,
  .fold-caret {
    transition: none;
  }
}
</style>
