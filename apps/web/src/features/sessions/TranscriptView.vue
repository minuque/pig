<template>
  <section class="transcript-region" aria-labelledby="transcript-title">
    <h2 id="transcript-title" class="sr-only">Transcript</h2>
    <div ref="transcriptElement" class="transcript" aria-live="off" @scroll="recordScroll">
      <div ref="transcriptContent" class="transcript-content">
        <template v-if="transcript.length">
          <article
            v-for="item in transcript"
            :key="item.id"
            class="msg"
            :class="{ streaming: isStreamingItem(item) }"
          >
            <div v-if="part(item)?.kind === 'user'" class="msg-prompt">
              <span class="who" aria-hidden="true">我</span>
              <div class="text">{{ userText(item) }}</div>
            </div>
            <div v-else-if="part(item)?.kind === 'agent'" class="msg-agent">
              <div v-if="agentThinking(item).length" class="fold">
                <button
                  type="button"
                  class="fold-toggle"
                  :aria-expanded="thinkingOpen.has(item.id)"
                  @click="toggleThinking(item.id)"
                >
                  <span class="fold-caret" aria-hidden="true">▸</span>
                  思考过程
                </button>
                <div class="reveal" :data-open="thinkingOpen.has(item.id)">
                  <div class="fold-body thinking-body">
                    <p v-for="(block, i) in agentThinking(item)" :key="i">{{ block }}</p>
                  </div>
                </div>
              </div>
              <MarkdownRender
                v-if="agentText(item)"
                mode="chat"
                :content="agentText(item)"
                code-renderer="pre"
                html-policy="safe"
                :smooth-streaming="false"
                :typewriter="false"
                :fade="false"
              />
              <span
                v-if="agentStatus(item) === 'error' || agentStatus(item) === 'aborted'"
                class="msg-status"
                role="status"
              >
                {{ agentStatus(item) === "error" ? "出错" : "已中止" }}
              </span>
            </div>
            <div v-else-if="part(item)" class="msg-tool">
              <div class="fold">
                <button
                  type="button"
                  class="fold-toggle"
                  :aria-expanded="toolOpen.has(item.id)"
                  @click="toggleTool(item.id)"
                >
                  <span class="fold-caret" aria-hidden="true">▸</span>
                  <span
                    class="dot"
                    aria-hidden="true"
                    :style="{
                      backgroundColor: isToolError(item)
                        ? 'var(--accent-orange)'
                        : 'var(--accent-green)',
                    }"
                  ></span>
                  <span class="tool-name mono">{{ toolName(item) }}</span>
                </button>
                <div class="reveal" :data-open="toolOpen.has(item.id)">
                  <div class="fold-body tool-body">
                    <MarkdownRender
                      mode="chat"
                      :content="toolResult(item)"
                      code-renderer="pre"
                      html-policy="safe"
                      :smooth-streaming="false"
                      :typewriter="false"
                      :fade="false"
                    />
                  </div>
                </div>
              </div>
            </div>
          </article>
          <article v-if="running" class="msg run-streaming">
            <div class="stream-head">
              <span class="stream-dot" aria-hidden="true"></span>
              <span class="stream-note">Agent 正在运行…</span>
              <span style="flex: 1"></span>
              <button type="button" class="secondary" :disabled="aborting" @click="emit('abort')">
                {{ aborting ? "取消中…" : "停止" }}
              </button>
            </div>
          </article>
        </template>
        <p v-else-if="phase !== 'idle' && phase !== undefined" class="shimmer" role="status">
          正在运行…
        </p>
        <p v-else class="notice">暂无消息。</p>
      </div>
    </div>
    <button v-if="hasNewActivity" class="jump-latest" type="button" @click="scrollToLatest">
      跳转到最新
    </button>
  </section>
</template>

<script setup lang="ts">
import MarkdownRender from "markstream-vue";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { SessionPhase, TranscriptItem } from "@earendil-works/pi-protocol";
import { scrollStateFrom, type TranscriptScrollState } from "@features/sessions/session-state.js";
import {
  projectTranscriptItem,
  type TranscriptPart,
} from "@features/sessions/transcript-format.js";

const props = defineProps<{
  sessionId: string;
  /** 官方 TranscriptItem 列表：RemoteSession 维护的投影 */
  transcript: readonly TranscriptItem[];
  /** 当前 Session phase：非 idle 时显示 streaming 状态条 */
  phase: SessionPhase | undefined;
  /** 取消中：禁用停止按钮并切换文案 */
  aborting: boolean;
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
}>();

const emit = defineEmits<{
  abort: [];
  "scroll-state": [state: TranscriptScrollState];
}>();

const running = computed(() => props.phase !== undefined && props.phase !== "idle");

/* ── 条目解析（思考/工具活动折叠；键用官方 item.id） ───────────────── */
const thinkingOpen = ref(new Set<string>());
const toolOpen = ref(new Set<string>());
const parts = new WeakMap<TranscriptItem, TranscriptPart | undefined>();
function part(item: TranscriptItem): TranscriptPart | undefined {
  let value = parts.get(item);
  if (!value && !parts.has(item)) {
    value = projectTranscriptItem(item);
    parts.set(item, value);
  }
  return value;
}
function agentThinking(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "agent" ? p.thinking : [];
}
function agentText(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "agent" ? p.text : "";
}
function agentStatus(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "agent" ? p.status : "complete";
}
function userText(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "user" ? p.text : "";
}
function toolName(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "tool" ? p.name : "";
}
function toolResult(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "tool" ? p.text : "";
}
function isToolError(item: TranscriptItem) {
  const p = part(item);
  return p?.kind === "tool" ? p.isError : false;
}
function toggleThinking(id: string) {
  const next = new Set(thinkingOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  thinkingOpen.value = next;
}
function toggleTool(id: string) {
  const next = new Set(toolOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  toolOpen.value = next;
}
/** 最后一条可见条目为正在 streaming 的 agent 消息时加 streaming 边框 */
function isStreamingItem(item: TranscriptItem): boolean {
  if (!running.value || item !== props.transcript[props.transcript.length - 1]) return false;
  return part(item)?.kind === "agent" && item.role !== "user" && item.status === "streaming";
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
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--canvas-soft);
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
  padding: var(--spacing-md);
}
.streaming {
  border-left: var(--border-width-emphasis) solid var(--primary);
  padding-left: var(--spacing-sm);
}
.msg {
  margin-bottom: var(--spacing-md);
}
.msg-prompt {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.msg-prompt .who {
  flex: none;
  width: 26px;
  height: 26px;
  border-radius: var(--radius-full);
  background: var(--ink);
  color: var(--on-primary);
  font-size: 12px;
  font-weight: var(--font-weight-semibold);
  display: grid;
  place-items: center;
}
.msg-prompt .text {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--surface);
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.msg-agent {
  padding: var(--spacing-md) 0;
}
.msg-status {
  display: inline-block;
  margin-top: var(--spacing-xs);
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
}
.msg-tool {
  margin-bottom: var(--spacing-md);
}
.run-streaming {
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border-left: var(--border-width-emphasis) solid var(--primary);
}
.stream-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}
.stream-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--primary);
  animation: dot-pulse 1.6s var(--ease-in-out) infinite;
}
.stream-note {
  color: var(--ink-muted);
  font-size: 13px;
}
.shimmer {
  color: var(--ink-muted);
}
.jump-latest {
  position: absolute;
  right: var(--spacing-md);
  bottom: var(--spacing-md);
  box-shadow: var(--shadow-float);
}
.fold {
  margin-bottom: var(--spacing-xs);
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
.fold-toggle .dot {
  flex: none;
}
.tool-name {
  color: inherit;
  font-size: 12px;
}
.reveal {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--duration-normal) var(--ease-smooth);
}
.reveal[data-open="true"] {
  grid-template-rows: 1fr;
}
.reveal > * {
  overflow: hidden;
}
.fold-body {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-left: var(--border-width-emphasis) solid var(--hairline);
  background: var(--canvas-soft);
  border-radius: var(--radius-sm);
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
.tool-body {
  font-size: var(--text-body-sm);
}
.secondary {
  font: inherit;
  font-size: var(--text-caption);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  border: var(--border-width) solid var(--hairline);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}
.secondary:hover:not(:disabled) {
  background: var(--canvas-soft);
}
.secondary:disabled {
  opacity: 0.5;
  cursor: default;
}
@keyframes dot-pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .reveal,
  .fold-caret {
    transition: none;
    animation: none;
  }
  .stream-dot {
    animation: none;
  }
}
</style>
