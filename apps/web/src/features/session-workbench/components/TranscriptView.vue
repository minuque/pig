<template>
  <section
    id="transcript-panel"
    ref="region"
    class="transcript-region"
    :aria-labelledby="transcriptTitleId"
  >
    <h2 :id="transcriptTitleId" class="sr-only">对话</h2>
    <MarkstreamVirtualTimeline
      v-if="rows.length"
      ref="timeline"
      class="transcript"
      :thread-key="sessionId"
      :measurement-key="measurementKey"
      :items="rows"
      :get-key="rowKey"
      :get-kind="transcriptRowKind"
      :get-content="transcriptRowContent"
      :get-final="transcriptRowFinal"
      :estimate-item-height="estimateTranscriptRowHeight"
      markdown-mode="chat"
      :stick-to-bottom="'auto'"
      :overscan="8"
      :initial-thread-state="threadState"
      @thread-state-change="onThreadState"
    >
      <template #default="{ item: row, measureRef, markdownProps }">
        <div :ref="measureRef" class="row">
          <UserMessage v-if="row.role === 'user'" :item="row" />
          <AssistantMessage
            v-else-if="row.role === 'assistant'"
            :item="row"
            :streaming="isStreamingAssistant(row)"
            :timeline-markdown="markdownProps"
          />
          <ToolCall v-else-if="row.role === 'tool'" :item="row" />
        </div>
      </template>
    </MarkstreamVirtualTimeline>
    <p v-else-if="running" class="shimmer" role="status">正在运行…</p>
    <button
      v-if="hasNewActivity"
      class="jump-latest"
      type="button"
      aria-label="跳转到最新"
      @click="scrollToLatest"
    >
      <ArrowDown :size="16" />
    </button>
  </section>
</template>

<script lang="ts">
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import {
  assistantThinking,
  isAssistantItem,
  transcriptText,
} from "@features/session-workbench/lib/transcript-format.js";

/** 时间线认 Markdown 的 kind：仅助手正文。 */
export function transcriptRowKind(item: TranscriptItem): string {
  if (item.role === "assistant") return "assistant-markdown";
  if (item.role === "tool") return "tool-call";
  return "user-message";
}

export function transcriptRowContent(item: TranscriptItem): string {
  return isAssistantItem(item) ? transcriptText(item) : "";
}

export function transcriptRowFinal(item: TranscriptItem): boolean {
  return !(isAssistantItem(item) && item.status === "streaming");
}

function estimateWrappedLines(text: string, charsPerLine: number): number {
  if (!text) return 1;
  let lines = 0;
  for (const part of text.split("\n")) {
    lines += Math.max(1, Math.ceil(part.length / charsPerLine));
  }
  return lines;
}

/**
 * 虚拟列表估高：宁可偏高，避免宽度变窄后按 200px 塞进过多未测行。
 * 助手约 48 字/行、26px 行高；用户约 36 字/行、22px 行高。
 */
export function estimateTranscriptRowHeight(item: TranscriptItem): number {
  if (item.role === "tool") return 48;
  const text = transcriptText(item);
  if (item.role === "user") {
    return Math.min(280, 56 + estimateWrappedLines(text, 36) * 22);
  }
  const height = 36 + estimateWrappedLines(text, 48) * 26;
  const thinking = isAssistantItem(item) && assistantThinking(item).length > 0 ? 36 : 0;
  return Math.min(960, Math.max(160, height + thinking));
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { ArrowDown } from "lucide-vue-next";
import { MarkstreamVirtualTimeline, type MarkstreamThreadVirtualState } from "markstream-vue";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import AssistantMessage from "@features/session-workbench/components/AssistantMessage.vue";
import ToolCall from "@features/session-workbench/components/ToolCall.vue";
import UserMessage from "@features/session-workbench/components/UserMessage.vue";
import { conversationRows } from "@features/session-workbench/lib/transcript-format.js";
import { useColorScheme } from "@features/theme/hooks/use-color-scheme.js";

const props = defineProps<{
  sessionId: string;
  /** 官方 TranscriptItem 列表：RemoteSession 维护的投影 */
  transcript: readonly TranscriptItem[];
  /** 当前 Session phase：非 idle 时显示 streaming 空态 */
  phase: SessionPhase | undefined;
  /** 上次离开该会话时的虚拟滚动状态，用于恢复滚动位置与行高缓存 */
  threadState: MarkstreamThreadVirtualState | null;
}>();

const emit = defineEmits<{
  "thread-state": [state: MarkstreamThreadVirtualState];
}>();

const running = computed(() => props.phase !== undefined && props.phase !== "idle");
const rows = computed(() => conversationRows(props.transcript));
const transcriptTitleId = computed(() => `transcript-title-${props.sessionId}`);
const region = useTemplateRef<HTMLElement>("region");
const { isDark } = useColorScheme();
const measurementKey = computed(() => (isDark.value ? "dark" : "light"));

// 虚拟滚动行 key：以 TranscriptItem id 保证流式输出时同一行原地更新
function rowKey(item: TranscriptItem): string {
  return item.id;
}

function isStreamingAssistant(item: TranscriptItem): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false;
  return isAssistantItem(item) && item.status === "streaming";
}

/* ── 贴底跟随与「跳转到最新」：滚动状态由 MarkstreamVirtualTimeline 管理 ── */
const timeline = useTemplateRef<{
  scrollToBottom(): void;
  captureThreadState(): MarkstreamThreadVirtualState;
}>("timeline");
// 与 stickToBottom=auto 对齐：离底 ≤48px 仍视为贴底（时间线会继续跟随）
const atBottom = ref(true);
const hasNewActivity = ref(false);

function timelineScrollRoot(): HTMLElement | null {
  return region.value?.querySelector<HTMLElement>(".markstream-virtual-timeline") ?? null;
}

function onThreadState(state: MarkstreamThreadVirtualState) {
  // 上报给 App 层（每 Session 唯一所有者），用于切会话后恢复
  emit("thread-state", state);
  const root = timelineScrollRoot();
  const bottom = root
    ? root.scrollHeight - root.scrollTop - root.clientHeight <= 48
    : state.outerAnchor?.type !== "item";
  atBottom.value = bottom;
  if (bottom) hasNewActivity.value = false;
}

// 新增消息行且用户不在底部时，提示「跳转到最新」（贴底时组件会自行跟随）
watch(
  () => rows.value.length,
  (length, previous) => {
    if (length > (previous ?? 0) && !atBottom.value) hasNewActivity.value = true;
  },
);

function scrollToLatest() {
  hasNewActivity.value = false;
  timeline.value?.scrollToBottom();
}

onBeforeUnmount(() => {
  const captured = timeline.value?.captureThreadState();
  if (captured) emit("thread-state", captured);
});
</script>

<style scoped>
.transcript-region {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
/* 滚动根自带 overflow:auto；首尾 inset 写在容器上，不进虚拟行高 */
.transcript {
  padding-top: var(--spacing-lg);
  padding-bottom: calc(var(--chat-input-space, 168px) + var(--spacing-md));
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--hairline) transparent;
}
.transcript::-webkit-scrollbar {
  width: 8px;
}
.transcript::-webkit-scrollbar-track {
  background: transparent;
}
.transcript::-webkit-scrollbar-thumb {
  background: var(--hairline);
  border-radius: var(--radius-full);
}
.transcript::-webkit-scrollbar-thumb:hover {
  background: var(--ink-muted);
}
/* 内容宽度约束：由每个虚拟行继承，替代原 transcript-content 的宽度盒 */
.transcript :deep(.markstream-virtual-timeline__item) {
  width: min(var(--size-content), 100%);
  margin-inline: auto;
}
.shimmer {
  color: var(--ink-muted);
}
.jump-latest {
  position: absolute;
  right: var(--spacing-lg);
  bottom: calc(var(--chat-input-space, 168px) + var(--spacing-md));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-full);
  background: var(--canvas-soft);
  color: var(--ink-secondary);
  box-shadow: var(--shadow-soft);
  cursor: pointer;
}
</style>
