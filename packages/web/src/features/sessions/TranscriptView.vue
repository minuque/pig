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
                  :aria-expanded="thinkingOpen.has(entryId(entry))"
                  @click="toggleThinking(entry)"
                >
                  <span class="fold-caret" aria-hidden="true">▸</span>
                  思考过程
                </button>
                <div class="reveal" :data-open="thinkingOpen.has(entryId(entry))">
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
                  :aria-expanded="toolOpen.has(entryId(entry))"
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
                <div class="reveal" :data-open="toolOpen.has(entryId(entry))">
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
    <button
      v-if="clientState?.hasNewActivity"
      class="jump-latest"
      type="button"
      @click="scrollToLatest"
    >
      跳转到最新
    </button>
  </section>
</template>

<script setup lang="ts">
import type { TranscriptEntry } from "@no-pi-no-gang/contracts";
import MarkdownRender from "markstream-vue";
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { terminalStatuses, type UiRun } from "../runs/run-state.js";
import RunStatusBadge from "../runs/RunStatusBadge.vue";
import { isNearBottom, type SessionClientState } from "./session-state.js";
import { parseTranscriptEntry, type TranscriptPart } from "./transcript-format.js";

const props = defineProps<{
  sessionId: string;
  transcript: TranscriptEntry[];
  loadingTranscript: boolean;
  transcriptError: string;
  sessionRuns: UiRun[];
  cancelling: Set<string>;
  clientState?: SessionClientState | undefined;
}>();

const emit = defineEmits<{
  "cancel-run": [run: UiRun];
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
const parts = new WeakMap<object, TranscriptPart | undefined>();
function part(entry: TranscriptEntry): TranscriptPart | undefined {
  let value = parts.get(entry);
  if (!value && !parts.has(entry)) {
    value = parseTranscriptEntry(entry);
    parts.set(entry, value);
  }
  return value;
}
function entryId(entry: TranscriptEntry) {
  return typeof entry.id === "string" ? entry.id : "";
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
  const message = entry.message as { content?: unknown } | undefined;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return (message.content as Array<{ text?: unknown }>)
      .map((block) => (typeof block?.text === "string" ? block.text : ""))
      .join("");
  }
  return "";
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
  const id = entryId(entry);
  const next = new Set(thinkingOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  thinkingOpen.value = next;
}
function toggleTool(entry: TranscriptEntry) {
  const id = entryId(entry);
  const next = new Set(toolOpen.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  toolOpen.value = next;
}

/* ── 滚动跟随 ─────────────────────────────────────────────────────── */
const transcriptElement = ref<HTMLElement>();
const transcriptContent = ref<HTMLElement>();
let switchingSession = false;
let restoreTarget: number | undefined;
const resizeObserver = new ResizeObserver(() => contentChanged());

function recordScroll() {
  if (switchingSession || !transcriptElement.value || !props.clientState) return;
  const element = transcriptElement.value;
  props.clientState.scrollTop = element.scrollTop;
  props.clientState.following = isNearBottom(
    element.scrollTop,
    element.clientHeight,
    element.scrollHeight,
  );
  if (props.clientState.following) props.clientState.hasNewActivity = false;
}
async function scrollToLatest() {
  await nextTick();
  if (!transcriptElement.value || !props.clientState) return;
  transcriptElement.value.scrollTop = transcriptElement.value.scrollHeight;
  props.clientState.scrollTop = transcriptElement.value.scrollTop;
  props.clientState.following = true;
  props.clientState.hasNewActivity = false;
}
function restoreScroll() {
  if (restoreTarget === undefined || props.loadingTranscript) return false;
  if (transcriptElement.value && props.clientState) {
    transcriptElement.value.scrollTop = restoreTarget;
    props.clientState.scrollTop = transcriptElement.value.scrollTop;
    props.clientState.following = isNearBottom(
      transcriptElement.value.scrollTop,
      transcriptElement.value.clientHeight,
      transcriptElement.value.scrollHeight,
    );
    props.clientState.hasNewActivity = false;
  }
  restoreTarget = undefined;
  switchingSession = false;
  return true;
}
function contentChanged() {
  if (!props.clientState || restoreScroll()) return;
  if (props.clientState.following) void scrollToLatest();
  else props.clientState.hasNewActivity = true;
}
watch(transcriptContent, (element, previous) => {
  if (previous) resizeObserver.unobserve(previous);
  if (element) resizeObserver.observe(element);
});
watch(
  () => props.sessionId,
  async () => {
    switchingSession = true;
    restoreTarget = props.clientState?.scrollTop ?? 0;
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
