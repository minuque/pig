<template>
  <section
    v-if="sessionId"
    :key="sessionId"
    class="workspace-main enter-blur"
    aria-labelledby="current-title"
  >
    <TranscriptView
      :session-id="sessionId"
      :transcript="transcript"
      :phase="phase"
      :aborting="aborting"
      :scroll-top="clientState?.scrollTop ?? 0"
      :following="clientState?.following ?? true"
      :has-new-activity="clientState?.hasNewActivity ?? false"
      @abort="abortSession"
      @scroll-state="applyScrollState"
    />

    <ChatInput
      v-model:prompt="prompt"
      v-model:preset="preset"
      :catalog="catalog"
      :phase="phase"
      :queued-steer-count="queuedSteerCount"
      :aborting="aborting"
      :error="sessionError"
      @send="submitText"
      @abort="abortSession"
    />
  </section>
</template>

<script setup lang="ts">
import ChatInput from "@components/composer/ChatInput.vue";
import { useWorkspace } from "@app/hooks/use-app.js";
import TranscriptView from "@features/sessions/TranscriptView.vue";

const {
  sessionId,
  transcript,
  phase,
  aborting,
  clientState,
  abortSession,
  applyScrollState,
  prompt,
  preset,
  catalog,
  queuedSteerCount,
  sessionError,
  submitText,
} = useWorkspace();
</script>

<style scoped>
.workspace-main {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}
.enter-blur {
  animation: enter-blur var(--duration-slow) var(--ease-out);
}
@media (prefers-reduced-motion: reduce) {
  .enter-blur {
    animation: none;
  }
}
@media (max-width: 900px) {
  .workspace-main {
    padding: var(--spacing-sm);
  }
}
@media (max-width: 520px) {
  .workspace-main {
    gap: var(--spacing-xs);
  }
}
</style>
