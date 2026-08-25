<template>
  <WorkbenchHeader />
  <StartupError v-if="pageError" v-bind="pageError" />

  <!-- 无 session：选目录并创建 -->
  <SessionWelcome v-else-if="!sessionId" />

  <div v-else class="session-stage">
    <SessionLoading v-if="sessionLoading" />

    <!-- 空会话：居中画布 -->
    <SessionEmptyCanvas v-if="emptyCanvas" />

    <!-- 有 transcript：对话列 -->
    <TranscriptView
      v-else-if="!sessionPending"
      ref="transcriptView"
      :session-id="sessionId"
      :transcript="transcript"
      :phase="phase"
      :thread-state="clientState?.threadState ?? null"
      :has-earlier="hasEarlier"
      :loading-earlier="loadingEarlier"
      @thread-state="applyThreadState"
      @load-earlier="loadEarlier"
      @ready="onTranscriptReady"
    >
      <ChatInput
        v-model:prompt="prompt"
        v-model:preset="preset"
        :catalog="catalog"
        :phase="phase"
        :aborting="aborting"
        :error="sessionError"
        :cwd="composerCwd"
        :usage="contextUsage"
        :session-id="sessionId"
        docked
        @send="submitFromDock"
        @abort="abortSession"
      />
    </TranscriptView>
  </div>
</template>

<script lang="ts">
import type { SessionPhase } from "@earendil-works/pi-protocol"

/** 无 transcript 且未运行：居中空画布。加载中、运行中即使无行也不走空画布。 */
export function isEmptyCanvas(
  transcriptLength: number,
  phase: SessionPhase | undefined,
  pending = false,
): boolean {
  if (pending) return false
  return transcriptLength === 0 && (phase === undefined || phase === "idle")
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
import { projectContextUsage } from "@features/chat-input/lib/context-usage.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { hasEarlierTranscript } from "@features/session-workbench/lib/session-state.js"
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
  contextUsageEstimate,
  phase,
  sessionPending,
  aborting,
  clientState,
  abortSession,
  applyThreadState,
  prompt,
  preset,
  catalog,
  projection,
  sessionError,
  submitText,
  loadEarlier,
  loadingEarlier,
  earlierExhausted,
  connectionError,
  connected,
} = useSession()
const { activeWorkspaceId, lastCwd, cardFootById } = useNav()

const pageError = computed(() => {
  if (connectionError.value && connected.value) {
    return { title: "连接失败", detail: connectionError.value.message }
  }
  return route.name === "error" ? {} : null
})
const streamReady = shallowRef(false)
const emptyCanvas = computed(() =>
  isEmptyCanvas(transcript.value.length, phase.value, sessionPending.value),
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
const hasEarlier = computed(() =>
  hasEarlierTranscript(
    transcript.value.length,
    sessionId.value ? cardFootById.value.get(sessionId.value)?.messageCount : undefined,
    earlierExhausted.value,
  ),
)
const heroCwd = computed(() => activeWorkspaceId.value ?? lastCwd.value)
const composerCwd = computed(() => projection.value?.cwd ?? heroCwd.value)
const contextUsage = computed(() => projectContextUsage(contextUsageEstimate.value))

const transcriptView = useTemplateRef<{
  prepareForSubmit(): void
}>("transcriptView")
function submitFromDock(text: string) {
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
</style>
