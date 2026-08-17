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
      :get-kind="rowKind"
      :estimate-item-height="estimateHeight"
      :stick-to-bottom="'auto'"
      :overscan="8"
      :initial-thread-state="threadState"
      @thread-state-change="onThreadState"
    >
      <template #default="{ item: row, index, measureRef }">
        <div
          :ref="measureRef"
          class="row"
          :class="{ 'row--first': index === 0, 'row--last': index === rows.length - 1 }"
        >
          <ConversationTurn
            v-if="row.kind === 'message'"
            :part="row.part"
            :item-id="row.item.id"
            :streaming="isStreamingItem(row.item, row.part)"
          />
          <ToolSummary v-else :part="row.part" />
        </div>
      </template>
    </MarkstreamVirtualTimeline>
    <p v-else-if="running" class="shimmer" role="status">正在运行…</p>
    <p v-else class="notice">暂无消息</p>
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

<script setup lang="ts">
import { useElementSize } from "@vueuse/core";
import { computed, ref, useTemplateRef, watch } from "vue";
import { ArrowDown } from "lucide-vue-next";
import { MarkstreamVirtualTimeline, type MarkstreamThreadVirtualState } from "markstream-vue";
import type { SessionPhase, TranscriptItem } from "@earendil-works/pi-protocol";
import ConversationTurn from "@features/session-workbench/components/ConversationTurn.vue";
import ToolSummary from "@features/session-workbench/components/ToolSummary.vue";
import { transcriptMeasurementKey } from "@features/session-workbench/transcript-layout.js";
import {
  conversationRows,
  type ConversationRow,
  type TranscriptPart,
} from "@features/session-workbench/transcript-format.js";
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
const { width } = useElementSize(region);
const { isDark } = useColorScheme();
const measurementKey = computed(() =>
  transcriptMeasurementKey(width.value, isDark.value ? "dark" : "light"),
);

// 虚拟滚动行 key：以 TranscriptItem id 保证流式输出时同一行原地更新
function rowKey(row: ConversationRow): string {
  return row.item.id;
}
function rowKind(row: ConversationRow): string {
  return row.kind;
}
// 初始行高估算：正文消息约 200px，工具一行摘要约 40px；实测后由组件修正
function estimateHeight(row: ConversationRow): number {
  return row.kind === "message" ? 200 : 40;
}

function isStreamingItem(
  item: TranscriptItem,
  part: Extract<TranscriptPart, { kind: "user" | "agent" }>,
): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false;
  return part.kind === "agent" && item.role === "assistant" && item.status === "streaming";
}

/* ── 贴底跟随与「跳转到最新」：滚动状态由 MarkstreamVirtualTimeline 管理 ── */
const timeline = useTemplateRef<{
  scrollToBottom(): void;
  captureThreadState(): MarkstreamThreadVirtualState;
}>("timeline");
// 用户是否贴在底部：bottom 锚点（或无锚点，初始态）视为贴底；item 锚点表示已上滚
const atBottom = ref(true);
const hasNewActivity = ref(false);

function onThreadState(state: MarkstreamThreadVirtualState) {
  // 上报给 App 层（每 Session 唯一所有者），用于切会话后恢复
  emit("thread-state", state);
  const bottom = state.outerAnchor?.type !== "item";
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
</script>

<style scoped>
.transcript-region {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
/* MarkstreamVirtualTimeline 根元素自带 overflow:auto 滚动容器，此处补充 pig 的视觉规范 */
.transcript {
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
.row--first {
  padding-top: var(--spacing-lg);
}
.row--last {
  padding-bottom: calc(var(--chat-input-space, 168px) + var(--spacing-md));
}
.shimmer {
  color: var(--ink-muted);
}
.notice {
  padding: var(--spacing-sm) 0;
  background: transparent;
  border: 0;
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
