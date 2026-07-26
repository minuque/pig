<script setup lang="ts">
import type { TranscriptItem } from "@no-pi-no-gang/contracts";
import { computed } from "vue";
import {
  runStateLabel,
  type TranscriptEntry,
} from "@/features/session/use-session-view";
import MarkdownView from "@/features/transcript/components/MarkdownView.vue";

/**
 * One Transcript entry: either a durable item owned by Vue Query or the
 * Live Overlay of a nonterminal Run. User/assistant message text renders as
 * safe Markdown; unsupported kinds degrade to a labelled placeholder so
 * forward-compatible content never breaks the list.
 */
const props = defineProps<{ entry: TranscriptEntry }>();

const durable = computed<TranscriptItem | null>(() =>
  props.entry.kind === "durable" ? props.entry.item : null,
);
const live = computed(() => (props.entry.kind === "live" ? props.entry : null));

const liveTools = computed(() => {
  const current = live.value;
  if (!current) return [];
  return current.run.toolOrder
    .map((callId) => current.run.tools[callId])
    .filter((tool) => tool !== undefined);
});

const ariaLabel = computed(() => {
  const item = durable.value;
  if (item) {
    switch (item.kind) {
      case "message":
        return item.role === "user" ? "用户消息" : "助手消息";
      case "toolCall":
        return "工具调用";
      case "toolResult":
        return "工具结果";
      case "compaction":
        return "上下文压缩";
      case "modelChange":
        return "模型切换";
      case "notice":
        return "通知";
      case "unsupported":
        return "不支持的内容";
    }
  }
  return "进行中的输出";
});

function formatTime(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <article class="transcript-item" :aria-label="ariaLabel">
    <template v-if="durable">
      <div
        v-if="durable.kind === 'message'"
        class="message"
        :data-role="durable.role"
      >
        <p class="message-meta">
          <span class="message-role">
            {{ durable.role === "user" ? "你" : "助手" }}
          </span>
          <time :datetime="durable.createdAt">{{
            formatTime(durable.createdAt)
          }}</time>
        </p>
        <MarkdownView
          v-if="durable.role === 'assistant'"
          :source="durable.text"
        />
        <p v-else class="message-user-text">{{ durable.text }}</p>
      </div>

      <details v-else-if="durable.kind === 'toolCall'" class="tool-call">
        <summary>
          <span class="tool-name">{{ durable.toolName }}</span>
          <span v-if="durable.summary" class="tool-summary">{{
            durable.summary
          }}</span>
        </summary>
        <p class="tool-detail">调用 ID：{{ durable.callId }}</p>
      </details>

      <div
        v-else-if="durable.kind === 'toolResult'"
        class="tool-result"
        :data-status="durable.status"
      >
        <p class="tool-result-meta">
          工具结果 · {{ durable.status === "success" ? "成功" : "失败" }}
        </p>
        <pre class="tool-result-text">{{ durable.text }}</pre>
      </div>

      <p v-else-if="durable.kind === 'compaction'" class="meta-note">
        上下文已压缩：{{ durable.summary }}
      </p>

      <p v-else-if="durable.kind === 'modelChange'" class="meta-note">
        模型已切换为 {{ durable.modelId }}
      </p>

      <p
        v-else-if="durable.kind === 'notice'"
        class="meta-note"
        :data-level="durable.level"
      >
        {{ durable.text }}
      </p>

      <p v-else class="meta-note">
        {{
          durable.kind === "unsupported"
            ? (durable.safeLabel ?? `不支持的内容类型：${durable.sourceType}`)
            : ""
        }}
      </p>
    </template>

    <div v-else-if="live" class="live-run">
      <p class="live-status">
        <span class="badge" data-tone="warning">{{
          live.runState ? runStateLabel(live.runState) : "进行中"
        }}</span>
      </p>
      <details v-if="live.run.thinking !== ''" class="thinking">
        <summary>思考过程</summary>
        <p class="thinking-text">{{ live.run.thinking }}</p>
      </details>
      <ul v-if="liveTools.length > 0" class="live-tools">
        <li v-for="tool in liveTools" :key="tool.callId">
          <span class="tool-name">{{ tool.status }}</span>
          <span v-if="tool.summary" class="tool-summary">{{
            tool.summary
          }}</span>
        </li>
      </ul>
      <MarkdownView v-if="live.run.text !== ''" :source="live.run.text" />
    </div>
  </article>
</template>

<style scoped>
.transcript-item {
  line-height: var(--line-reading);
  overflow-wrap: break-word;
}

.message-meta {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin-bottom: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
  line-height: var(--line-compact);
}

.message-role {
  font-weight: 600;
  color: var(--color-foreground);
}

.message-user-text {
  white-space: pre-wrap;
}

.tool-call,
.tool-result {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-sm);
}

.tool-call summary {
  cursor: pointer;
  min-height: var(--target-min);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.tool-name {
  font-family: var(--font-code);
  color: var(--color-tool);
}

.tool-summary {
  color: var(--color-foreground-muted);
}

.tool-detail {
  margin-top: var(--space-2);
  color: var(--color-foreground-muted);
  font-size: var(--text-xs);
}

.tool-result-meta {
  font-size: var(--text-xs);
  color: var(--color-foreground-muted);
}

.tool-result[data-status="error"] .tool-result-meta {
  color: var(--color-danger);
}

.tool-result-text {
  margin: var(--space-2) 0 0;
  font-family: var(--font-code);
  font-size: var(--text-sm);
  white-space: pre-wrap;
}

.meta-note {
  color: var(--color-foreground-muted);
  font-size: var(--text-sm);
}

.meta-note[data-level="warning"] {
  color: var(--color-warning);
}

.meta-note[data-level="error"] {
  color: var(--color-danger);
}

.live-run {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.live-status {
  margin: 0;
}

.thinking summary {
  cursor: pointer;
  min-height: var(--target-min);
  display: flex;
  align-items: center;
  color: var(--color-thinking);
  font-size: var(--text-sm);
}

.thinking-text {
  color: var(--color-thinking);
  font-size: var(--text-sm);
  white-space: pre-wrap;
}

.live-tools {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-sm);
}
</style>
