<template>
  <WorkbenchHeader />
  <StartupError v-if="pageError" v-bind="pageError" />
  <SessionWelcome v-else-if="!sessionId" />
  <div v-else class="session-stage">
    <section
      v-if="emptyCanvas"
      class="empty-canvas enter-blur"
      aria-labelledby="session-hero-title"
    >
      <div class="empty-canvas-form">
        <WorkbenchHero
          :workspace-id="heroCwd"
          title-id="session-hero-title"
          :workspaces="workspaces"
          :selectable="false"
        />
        <ChatInput
          v-model:prompt="prompt"
          v-model:preset="preset"
          :catalog="catalog"
          :phase="phase"
          :error="sessionError"
          :cwd="composerCwd"
          :usage="contextUsage"
          :session-id="sessionId"
          @send="submitText"
        />
      </div>
    </section>
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
    <SessionLoading v-if="sessionLoading" />
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
import SessionLoading from "@features/session-workbench/components/SessionLoading.vue"
import SessionWelcome from "@features/session-workbench/components/SessionWelcome.vue"
import TranscriptView from "@features/transcript/index.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
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
const { workspaces, activeWorkspaceId, lastCwd, cardFootById } = useNav()

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
.empty-canvas {
  min-height: 0;
  flex: 1;
  display: grid;
  place-items: center;
  padding: 0 var(--spacing-md);
}
.empty-canvas-form {
  width: min(var(--size-composer), 100%);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.enter-blur {
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .enter-blur {
    animation: none;
  }
}
</style>
