<template>
  <WorkbenchHeader />
  <StartupError v-if="pageError" v-bind="pageError" />
  <SessionWelcome v-else-if="!sessionId" />
  <section
    v-else
    class="workspace-main enter-blur"
    :aria-labelledby="emptyCanvas ? 'session-hero-title' : 'current-title'"
    :aria-busy="sessionPending || undefined"
  >
    <div v-if="sessionPending" class="empty-canvas" role="status" aria-live="polite">
      <Spinner :size="24" aria-hidden="true" />
      <p class="sr-only">正在加载会话</p>
    </div>
    <div v-else-if="emptyCanvas" class="empty-canvas">
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
          @send="submitText"
        />
      </div>
    </div>

    <template v-else>
      <TranscriptView
        ref="transcriptView"
        :session-id="sessionId"
        :transcript="transcript"
        :phase="phase"
        :thread-state="clientState?.threadState ?? null"
        :has-earlier="hasEarlier"
        :loading-earlier="loadingEarlier"
        @thread-state="applyThreadState"
        @load-earlier="loadEarlier"
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
          docked
          @send="submitFromDock"
          @abort="abortSession"
        />
      </TranscriptView>
    </template>
  </section>
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
</script>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue"
import { useRoute } from "vue-router"
import ChatInput from "@features/chat-input/index.vue"
import { projectContextUsage } from "@features/chat-input/lib/context-usage.js"
import { useNav } from "@features/session-nav/index.js"
import { useSession } from "@features/session-workbench/index.js"
import { hasEarlierTranscript } from "@features/session-workbench/lib/session-state.js"
import SessionWelcome from "@features/session-workbench/components/SessionWelcome.vue"
import TranscriptView from "@features/session-workbench/components/TranscriptView.vue"
import WorkbenchHeader from "@features/session-workbench/components/WorkbenchHeader.vue"
import WorkbenchHero from "@features/session-workbench/components/WorkbenchHero.vue"
import StartupError from "@features/startup/components/StartupError.vue"
import { Spinner } from "@components/ui/spinner/index.js"

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
const emptyCanvas = computed(() =>
  isEmptyCanvas(transcript.value.length, phase.value, sessionPending.value),
)
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
.workspace-main {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  background: var(--surface);
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
