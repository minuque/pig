<template>
  <section class="transcript-region" aria-labelledby="transcript-title">
    <h2 id="transcript-title" class="sr-only">Transcript</h2>
    <div ref="transcriptElement" class="transcript" aria-live="off" @scroll="recordScroll">
      <div ref="transcriptContent" class="transcript-content">
        <p v-if="loadingTranscript" role="status">正在加载 Transcript…</p>
        <div v-else-if="transcriptError" class="notice error" role="alert">
          {{ transcriptError }}
        </div>
        <article
          v-for="(entry, index) in transcript"
          :key="`${sessionId}:${index}`"
          class="msg"
          :class="isUser(entry) ? 'msg-prompt' : 'msg-agent'"
        >
          <template v-if="isUser(entry)">
            <span class="who" aria-hidden="true">我</span>
            <div class="text">{{ transcriptText(entry) }}</div>
          </template>
          <MarkdownRender
            v-else
            mode="chat"
            :content="transcriptText(entry)"
            code-renderer="pre"
            html-policy="safe"
            :smooth-streaming="false"
            :typewriter="false"
            :fade="false"
          />
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
        <p
          v-if="!loadingTranscript && transcript.length === 0 && sessionRuns.length === 0"
          class="notice"
        >
          暂无消息。
        </p>
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
import { terminalStatuses, transcriptText, type UiRun } from "../runs/run-state.js";
import RunStatusBadge from "../runs/RunStatusBadge.vue";
import { isNearBottom, type SessionClientState } from "./session-state.js";

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
function isUser(entry: Record<string, unknown>) {
  return entry.role === "user";
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
