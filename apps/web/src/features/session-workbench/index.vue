<template>
  <WorkbenchHeader />
  <StartupError v-if="pageError" v-bind="pageError" />

  <!-- 1. 无 session -->
  <SessionWelcome v-else-if="!sessionId" />

  <div v-else class="session-stage">
    <SessionLoading v-if="sessionLoading" />

    <!-- 2. 空会话 -->
    <SessionEmptyCanvas v-if="emptyCanvas" />

    <!-- 3. 有 transcript：对话列 -->
    <template v-else-if="!sessionPending">
      <TranscriptView
        ref="transcriptView"
        :session-id="sessionId"
        :transcript="transcript"
        :running="running"
        :thread-state="threadState"
        @thread-state="applyThreadState"
        @ready="onTranscriptReady"
      />
      <div class="chat-input-bar">
        <ChatInput
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="catalog"
          :running="running"
          :aborting="aborting"
          :error="sessionError"
          :cwd="composerCwd"
          :usage="contextUsage"
          :session-id="sessionId"
          @send="submitFromInput"
          @abort="abortSession"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
/** 无 transcript 且未运行：居中空画布。加载中、运行中即使无行也不走空画布。 */
export function isEmptyCanvas(
  transcriptLength: number,
  running: boolean,
  pending = false,
): boolean {
  if (pending) return false
  return transcriptLength === 0 && !running
}

/** 远程未附加，或已附加但 markdown-stream 尚未渲染完：继续遮罩。 */
export function isSessionLoading(
  pending: boolean,
  transcriptLength: number,
  streamReady: boolean,
): boolean {
  return pending || (transcriptLength > 0 && !streamReady)
}
</script>

<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from "vue"
import { useRoute } from "vue-router"
import ChatInput from "@features/chat-input/index.vue"
import { useSession } from "@features/session-workbench/index.js"
import SessionEmptyCanvas from "@features/session-workbench/components/SessionEmptyCanvas.vue"
import SessionLoading from "@features/session-workbench/components/SessionLoading.vue"
import SessionWelcome from "@features/session-workbench/components/SessionWelcome.vue"
import TranscriptView from "@features/transcript-view/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import StartupError from "@features/startup/components/StartupError.vue"

const route = useRoute()
const {
  sessionId,
  transcript,
  composerCwd,
  contextUsage,
  running,
  sessionPending,
  aborting,
  clientState,
  abortSession,
  applyThreadState,
  prompt,
  preset,
  catalog,
  sessionError,
  submitText,
  connectionError,
  connected,
} = useSession()

const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
  }
  return route.name === "error" ? {} : null
})
const streamReady = shallowRef(false)
const emptyCanvas = computed(() =>
  isEmptyCanvas(transcript.value.length, running.value, sessionPending.value),
)
const sessionLoading = computed(() =>
  isSessionLoading(sessionPending.value, transcript.value.length, streamReady.value),
)
watch(sessionId, () => {
  streamReady.value = false
})
function onTranscriptReady() {
  streamReady.value = true
}
const threadState = computed(() => clientState.value?.threadState ?? null)

const transcriptView = useTemplateRef<{
  prepareForSubmit(): void
}>("transcriptView")
function submitFromInput(text: string) {
  transcriptView.value?.prepareForSubmit()
  return submitText(text)
}
</script>

<style scoped>
.session-stage {
  position: relative;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}
.chat-input-bar {
  flex-shrink: 0;
  padding: 0 var(--spacing-md) 10px;
  background: var(--surface);
}
@media (max-width: 900px) {
  .chat-input-bar {
    padding-inline: var(--spacing-sm);
  }
}
</style>
