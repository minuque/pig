<template>
  <section class="transcript-region" aria-labelledby="transcript-title">
    <h2 id="transcript-title" class="sr-only">Transcript</h2>
    <div ref="transcriptElement" class="transcript" aria-live="off" @scroll="recordScroll">
      <div ref="transcriptContent" class="transcript-content">
        <p v-if="loadingTranscript" class="shimmer" role="status">正在加载 Transcript…</p>
        <div v-else-if="transcriptError" class="notice error" role="alert">
          {{ transcriptError }}
        </div>
        <template v-else>
          <article v-for="(entry, index) in transcript" :key="`${sessionId}:${index}`" class="msg">
            <div v-if="part(entry)?.kind === 'user'" class="msg-prompt">
              <span class="who" aria-hidden="true">我</span>
              <div class="text">{{ userText(entry) }}</div>
            </div>
            <div v-else-if="part(entry)?.kind === 'agent'" class="msg-agent">
              <div v-if="agentThinking(entry).length" class="fold">
                <button
                  type="button"
                  class="fold-toggle"
                  :aria-expanded="thinkingOpen.has(foldKey(entry))"
                  @click="toggleThinking(entry)"
                >
                  <span class="fold-caret" aria-hidden="true">▸</span>
                  思考过程
                </button>
                <div class="reveal" :data-open="thinkingOpen.has(foldKey(entry))">
                  <div class="fold-body thinking-body">
                    <p v-for="(block, i) in agentThinking(entry)" :key="i">{{ block }}</p>
                  </div>
                </div>
              </div>
              <MarkdownRender
                v-if="agentText(entry)"
                mode="chat"
                :content="agentText(entry)"
                code-renderer="pre"
                html-policy="safe"
                :smooth-streaming="false"
                :typewriter="false"
                :fade="false"
              />
            </div>
            <div v-else-if="part(entry)?.kind === 'tool'" class="msg-tool">
              <div class="fold">
                <button
                  type="button"
                  class="fold-toggle"
                  :aria-expanded="toolOpen.has(foldKey(entry))"
                  @click="toggleTool(entry)"
                >
                  <span class="fold-caret" aria-hidden="true">▸</span>
                  <span
                    class="dot"
                    aria-hidden="true"
                    :style="{
                      backgroundColor: isToolError(entry)
                        ? 'var(--accent-orange)'
                        : 'var(--accent-green)',
                    }"
                  ></span>
                  <span class="tool-name mono">{{ toolName(entry) }}</span>
                </button>
                <div class="reveal" :data-open="toolOpen.has(foldKey(entry))">
                  <div class="fold-body tool-body">
                    <MarkdownRender
                      mode="chat"
                      :content="toolResult(entry)"
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
            <div v-else-if="part(entry)" class="msg-other mono">
              <span class="other-label">{{ otherLabel(entry) }}</span>
            </div>
          </article>
          <article
            v-for="run in sessionRuns"
            :key="run.id"
            class="msg run-block"
            :class="[`status-${run.status}`, { streaming: !terminalStatuses.has(run.status) }]"
          >
            <div class="run-head">
              <RunStatusBadge :status="run.status" />
              <span class="run-id mono">{{ run.id.slice(0, 12) }}</span>
              <span v-if="terminalStatuses.has(run.status)" class="run-note">{{
                terminalNote(run.status)
              }}</span>
              <span style="flex: 1"></span>
              <button
                v-if="!terminalStatuses.has(run.status)"
                type="button"
                class="secondary"
                :disabled="cancelling.has(run.id)"
                @click="emit('cancel-run', run)"
              >
                {{ cancelling.has(run.id) ? "取消中…" : "取消 Run" }}
              </button>
            </div>
            <MarkdownRender
              mode="chat"
              :content="run.output"
              code-renderer="pre"
              html-policy="safe"
              :smooth-streaming="terminalStatuses.has(run.status) ? false : 'auto'"
              :typewriter="!terminalStatuses.has(run.status)"
              :fade="false"
            />
          </article>
          <p v-if="transcript.length === 0 && sessionRuns.length === 0" class="notice">
            暂无消息。
          </p>
        </template>
      </div>
    </div>
    <button v-if="hasNewActivity" class="jump-latest" type="button" @click="scrollToLatest">
      跳转到最新
    </button>
  </section>
</template>

<script lang="ts">
import type { TranscriptEntry } from "@pig/contracts";

/**
 * 折叠键分配器：条目自带非空字符串 id 时直接用该 id；否则按对象身份分配稳定序号键。
 * 对象身份键不随列表追加/重排变化，避免索引或空字符串导致的错位与共享折叠状态。
 */
export function createFoldKey() {
  const keys = new WeakMap<object, number>();
  let next = 0;
  return (entry: TranscriptEntry): string => {
    if (typeof entry.id === "string" && entry.id) return `id:${entry.id}`;
    let key = keys.get(entry);
    if (key === undefined) {
      key = next++;
      keys.set(entry, key);
    }
    return `obj:${key}`;
  };
}
</script>

<script setup lang="ts">
import MarkdownRender from "markstream-vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { terminalStatuses, type UiRun } from "../runs/run-state.js";
import RunStatusBadge from "../runs/RunStatusBadge.vue";
import { scrollStateFrom, type TranscriptScrollState } from "./session-state.js";
import { parseTranscriptEntry, type TranscriptPart } from "./transcript-format.js";

const props = defineProps<{
  sessionId: string;
  transcript: TranscriptEntry[];
  loadingTranscript: boolean;
  transcriptError: string;
  sessionRuns: UiRun[];
  cancelling: Set<string>;
  scrollTop: number;
  following: boolean;
  hasNewActivity: boolean;
}>();

const emit = defineEmits<{
  "cancel-run": [run: UiRun];
  "scroll-state": [state: TranscriptScrollState];
}>();

const TERMINAL_NOTES: Record<string, string> = {
  completed: "Run 已完成，已并入会话记录",
  failed: "Run 失败",
  cancelled: "Run 已取消",
};
function terminalNote(status: string) {
  return TERMINAL_NOTES[status] ?? "";
}

/* ── 条目解析（思考/工具活动折叠） ───────────────────────────────── */
const thinkingOpen = ref(new Set<string>());
const toolOpen = ref(new Set<string>());
const foldKey = createFoldKey();
const parts = new WeakMap<object, TranscriptPart | undefined>();
function part(entry: TranscriptEntry): TranscriptPart | undefined {
  let value = parts.get(entry);
  if (!value && !parts.has(entry)) {
    value = parseTranscriptEntry(entry);
    parts.set(entry, value);
  }
  return value;
}
function agentThinking(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "agent" ? p.thinking : [];
}
function agentText(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "agent" ? p.text : "";
}
function userText(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "user" ? p.text : "";
}
function toolName(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "tool" ? p.name : "";
}
function toolResult(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "tool" ? p.text : "";
}
function isToolError(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "tool" ? p.isError : false;
}
function otherLabel(entry: TranscriptEntry) {
  const p = part(entry);
  return p?.kind === "other" ? p.label : "";
}
function toggleThinking(entry: TranscriptEntry) {
  const id = foldKey(entry);
  const next = new Set(thinkingOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  thinkingOpen.value = next;
}
function toggleTool(entry: TranscriptEntry) {
  const id = foldKey(entry);
  const next = new Set(toolOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  toolOpen.value = next;
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
  if (restoreTarget === undefined || props.loadingTranscript) return false;
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
watch(
  () => props.loadingTranscript,
  async (loading) => {
    if (!loading) {
      await nextTick();
      restoreScroll();
    }
  },
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
.msg-tool {
  margin-bottom: var(--spacing-md);
}
.run-block {
  padding: var(--spacing-md);
  border: var(--border-width) solid var(--hairline);
  border-radius: var(--radius-lg);
  background: var(--surface);
  border-left: var(--border-width-emphasis) solid var(--primary);
}
.run-block.status-completed {
  border-left-color: var(--accent-green);
}
.run-block.status-failed {
  border-left-color: var(--accent-orange);
}
.run-block.status-cancelled {
  border-left-color: var(--ink-faint);
}
.run-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-xs);
  flex-wrap: wrap;
}
.run-id {
  color: var(--ink-muted);
  font-size: 12px;
}
.run-note {
  color: var(--ink-muted);
  font-size: 13px;
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
.msg-other {
  padding: var(--spacing-xxs) var(--spacing-sm);
  color: var(--ink-faint);
  font-size: var(--text-caption);
}
@media (prefers-reduced-motion: reduce) {
  .reveal,
  .fold-caret {
    transition: none;
    animation: none;
  }
}
</style>
