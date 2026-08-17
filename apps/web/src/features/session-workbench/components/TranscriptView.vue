<template>
  <section
    id="transcript-panel"
    ref="region"
    class="transcript-region"
    :aria-labelledby="transcriptTitleId"
  >
    <h2 :id="transcriptTitleId" class="sr-only">对话</h2>
    <Transition name="user-pin">
      <button
        v-if="pinText"
        class="user-pin"
        type="button"
        :aria-label="`回到用户句：${pinText}`"
        @click="scrollToPinnedUser"
      >
        {{ pinText }}
      </button>
    </Transition>
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
      :estimate-item-height="estimateHeight"
      markdown-mode="chat"
      markdown-code-renderer="monaco"
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

<script lang="ts">
import type { TranscriptItem } from "@earendil-works/pi-protocol";
import {
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
</script>

<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import { ArrowDown } from "lucide-vue-next";
import { MarkstreamVirtualTimeline, type MarkstreamThreadVirtualState } from "markstream-vue";
import type { SessionPhase } from "@earendil-works/pi-protocol";
import AssistantMessage from "@features/session-workbench/components/AssistantMessage.vue";
import ToolCall from "@features/session-workbench/components/ToolCall.vue";
import UserMessage from "@features/session-workbench/components/UserMessage.vue";
import {
  conversationRows,
  isUserItem,
  pinnedUserIndex,
  userPinLabel,
} from "@features/session-workbench/lib/transcript-format.js";
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
function estimateHeight(item: TranscriptItem): number {
  if (item.role === "tool") return 48;
  return item.role === "assistant" ? 200 : 88;
}

function isStreamingAssistant(item: TranscriptItem): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false;
  return isAssistantItem(item) && item.status === "streaming";
}

/* ── 贴底跟随与「跳转到最新」：滚动状态由 MarkstreamVirtualTimeline 管理 ── */
const timeline = useTemplateRef<{
  scrollToBottom(): void;
  scrollToIndex(index: number, align?: "start" | "center" | "end"): void;
  captureThreadState(): MarkstreamThreadVirtualState;
}>("timeline");
// 与 stickToBottom=auto 对齐：离底 ≤48px 仍视为贴底（时间线会继续跟随）
const atBottom = ref(true);
const hasNewActivity = ref(false);
const pinnedIndex = shallowRef(-1);
const pinText = computed(() => {
  const item = rows.value[pinnedIndex.value];
  return item && isUserItem(item) ? userPinLabel(item) : "";
});

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
  const list = rows.value;
  const scrollTop = root?.scrollTop ?? 0;
  const paddingTop = root ? Number.parseFloat(getComputedStyle(root).paddingTop) || 0 : 0;
  pinnedIndex.value = pinnedUserIndex(list, scrollTop, paddingTop, (index) => {
    const item = list[index];
    if (!item) return 0;
    return state.itemHeights[item.id] ?? estimateHeight(item);
  });
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

function scrollToPinnedUser() {
  if (pinnedIndex.value < 0) return;
  timeline.value?.scrollToIndex(pinnedIndex.value, "start");
}
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
.user-pin {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: 1;
  box-sizing: border-box;
  width: min(var(--size-content), 100%);
  margin-inline: auto;
  padding: 8px 14px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--primary);
  color: var(--on-primary);
  font-size: var(--text-body-md);
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}
.user-pin-enter-active,
.user-pin-leave-active {
  transition:
    transform var(--duration-normal) var(--ease-out),
    opacity var(--duration-fast) var(--ease-out);
}
.user-pin-enter-from,
.user-pin-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}
@media (prefers-reduced-motion: reduce) {
  .user-pin-enter-active,
  .user-pin-leave-active {
    transition: none;
  }
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
