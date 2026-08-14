<template>
  <section id="transcript-panel" class="transcript-region" :aria-labelledby="transcriptTitleId">
    <h2 :id="transcriptTitleId" class="sr-only">对话</h2>
    <div ref="transcriptElement" class="transcript" aria-live="off" @scroll="recordScroll">
      <div ref="transcriptContent" class="transcript-content">
        <template v-if="rows.length">
          <template v-for="row in rows" :key="row.item.id">
            <ConversationTurn
              v-if="row.kind === 'message'"
              :part="row.part"
              :streaming="isStreamingItem(row.item, row.part)"
            />
            <p v-else class="tool-summary">
              <span
                class="dot"
                aria-hidden="true"
                :style="{ backgroundColor: toolDot(row.part) }"
              ></span>
              <span class="mono">{{ row.part.name }}</span>
              <span>{{ toolStatusLabel(row.part.status, row.part.isError) }}</span>
            </p>
          </template>
        </template>
        <p v-else-if="running" class="shimmer" role="status">正在运行…</p>
        <p v-else class="notice">暂无消息</p>
      </div>
    </div>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { ArrowDown } from "lucide-vue-next";
import type { SessionPhase, TranscriptItem } from "@earendil-works/pi-protocol";
import ConversationTurn from "@features/session-workbench/components/ConversationTurn.vue";
import {
  scrollStateFrom,
  type TranscriptScrollState,
} from "@features/session-workbench/session-state.js";
import {
  conversationRows,
  toolStatusLabel,
  type TranscriptPart,
} from "@features/session-workbench/transcript-format.js";

const props = defineProps<{
  sessionId: string;
  /** 官方 TranscriptItem 列表：RemoteSession 维护的投影 */
  transcript: readonly TranscriptItem[];
  /** 当前 Session phase：非 idle 时显示 streaming 空态 */
  phase: SessionPhase | undefined;
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
}>();

const emit = defineEmits<{
  "scroll-state": [state: TranscriptScrollState];
}>();

const running = computed(() => props.phase !== undefined && props.phase !== "idle");
const rows = computed(() => conversationRows(props.transcript));
const transcriptTitleId = computed(() => `transcript-title-${props.sessionId}`);

function isStreamingItem(
  item: TranscriptItem,
  part: Extract<TranscriptPart, { kind: "user" | "agent" }>,
): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false;
  return part.kind === "agent" && item.role === "assistant" && item.status === "streaming";
}

function toolDot(part: Extract<TranscriptPart, { kind: "tool" }>): string {
  if (part.isError || part.status === "error" || part.status === "aborted") {
    return "var(--accent-orange)";
  }
  if (part.status === "running" || part.status === "streaming") return "var(--primary)";
  return "var(--accent-green)";
}

/* ── 滚动跟随：props 只读，变更一律通过 scroll-state 上报唯一所有者 ── */
const transcriptElement = ref<HTMLElement>();
const transcriptContent = ref<HTMLElement>();
let switchingSession = false;
// 恢复目标：进入 Session 时取所有者快照，首次恢复后一次性消费
let restoreTarget: number | undefined = props.scrollTop;
const resizeObserver = new ResizeObserver(() => contentChanged());

function recordScroll() {
  if (switchingSession || !transcriptElement.value) return;
  const element = transcriptElement.value;
  emit(
    "scroll-state",
    scrollStateFrom(
      element.scrollTop,
      element.clientHeight,
      element.scrollHeight,
      props.hasNewActivity,
    ),
  );
}
async function scrollToLatest() {
  await nextTick();
  if (!transcriptElement.value) return;
  transcriptElement.value.scrollTop = transcriptElement.value.scrollHeight;
  emit("scroll-state", {
    scrollTop: transcriptElement.value.scrollTop,
    following: true,
    hasNewActivity: false,
  });
}
function restoreScroll() {
  if (restoreTarget === undefined) return false;
  if (transcriptElement.value) {
    const element = transcriptElement.value;
    element.scrollTop = restoreTarget;
    emit(
      "scroll-state",
      scrollStateFrom(
        element.scrollTop,
        element.clientHeight,
        element.scrollHeight,
        props.hasNewActivity,
      ),
    );
  }
  restoreTarget = undefined;
  switchingSession = false;
  return true;
}
function contentChanged() {
  if (restoreScroll()) return;
  if (props.following) void scrollToLatest();
  else if (transcriptElement.value)
    emit("scroll-state", {
      scrollTop: transcriptElement.value.scrollTop,
      following: false,
      hasNewActivity: true,
    });
}
watch(transcriptContent, (element, previous) => {
  if (previous) resizeObserver.unobserve(previous);
  if (element) resizeObserver.observe(element);
});
watch(
  () => props.sessionId,
  async () => {
    switchingSession = true;
    restoreTarget = props.scrollTop;
    await nextTick();
    restoreScroll();
  },
  { flush: "pre" },
);
onBeforeUnmount(() => resizeObserver.disconnect());
</script>

<style scoped>
.transcript-region {
  position: relative;
  min-height: 0;
  overflow: hidden;
  background: transparent;
}
.transcript {
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
}
.transcript-content {
  width: min(var(--size-content), 100%);
  min-height: 100%;
  margin: auto;
  padding: var(--spacing-sm) 0 calc(var(--chat-input-space, 168px) + var(--spacing-sm));
}
.tool-summary {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin: 0 0 var(--spacing-sm);
  color: var(--ink-muted);
  font-size: var(--text-caption);
}
.tool-summary .dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: var(--radius-full);
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
  left: 50%;
  bottom: calc(var(--chat-input-space, 168px) + var(--spacing-md));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: var(--on-primary);
  transform: translateX(-50%);
  box-shadow: var(--shadow-float);
  cursor: pointer;
}
</style>
